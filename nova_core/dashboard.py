import frappe
from frappe.utils import add_months, date_diff, flt, get_first_day, getdate, today

from nova_core.gat import calc_fine, due_date, get_settings, sees_all


def _sum(doctype, field, filters):
	return flt(frappe.db.get_value(doctype, filters, [{"SUM": field}]))


@frappe.whitelist()
def get_dashboard():
	"""Data for the Gat workspace dashboard. Group figures are totals only; per-member lists are
	added for office bearers alone."""
	s = get_settings()
	month = get_first_day(today())
	due = due_date(month, s.due_day)
	days_late = max(date_diff(today(), due), 0)
	paid = {"docstatus": 1}

	opening_savings = _sum("Member", "opening_savings", {})
	saving = _sum("Monthly Payment", "saving", paid) + opening_savings
	interest = _sum("Monthly Payment", "interest", paid)
	fine = _sum("Monthly Payment", "fine", paid)
	principal = _sum("Monthly Payment", "principal", paid)
	expense = _sum("Group Expense", "amount", {})
	# old loans were paid out of the opening cash, before the app
	disbursed = _sum("Loan", "amount", {"disbursed_on": ["is", "set"], "is_opening": 0})
	exits = _sum("Member Exit", "payable", paid)

	members = frappe.get_all("Member", {"status": "Active"}, ["name", "member_name"], order_by="member_name")
	paid_members = set(frappe.get_all("Monthly Payment", {"docstatus": 1, "month": month}, pluck="member"))

	data = {
		"group_name": s.group_name,
		"month": month,
		"due_date": due,
		"days_to_due": date_diff(due, today()),
		"group": {
			"cash": flt(s.opening_cash) + saving - opening_savings + interest + fine + principal - disbursed - expense - exits,
			"savings": saving,
			"loans_out": _sum("Loan", "outstanding", {"status": "Active"}),
			"earnings": flt(s.opening_earnings) + interest + fine - expense,
			"members": len(members),
			"paid_this_month": len(paid_members),
			"interest": interest,
			"fines": fine,
			"expense": expense,
			"opening_earnings": flt(s.opening_earnings),
			"exits": exits,
		},
		"trends": _trends(month),
		"loan_mix": frappe.get_all(
			"Loan",
			filters={"docstatus": 1},
			fields=["status", {"COUNT": "*", "as": "count"}, {"SUM": "amount", "as": "amount"}],
			group_by="status",
		),
		"me": _my_panel(s, month, days_late),
		"is_admin": sees_all(),
		"can_enter": bool({"Khajinadar", "System Manager"} & set(frappe.get_roles())),
	}

	if data["is_admin"]:
		submitted = set(frappe.get_all("Monthly Payment", {"docstatus": 0, "month": month}, pluck="member"))
		fine_now = calc_fine(days_late, s.late_fine_first_day, s.late_fine_per_day)
		data["admin"] = {
			"to_verify": frappe.get_all(
				"Monthly Payment",
				{"docstatus": 0},
				["name", "member_name", "month", "total", "days_late", "payment_date"],
				order_by="payment_date",
			),
			"decisions": _decisions(),
			"unpaid": [dict(m, fine=fine_now) for m in members if m.name not in paid_members],
			"roster": [
				dict(m, state="paid" if m.name in paid_members else "submitted" if m.name in submitted else "pending")
				for m in members
			],
			"days_late": days_late,
			"loans_due": [
				dict(l, days=date_diff(l.due_date, today()) if l.due_date else None)
				for l in frappe.get_all(
					"Loan",
					{"status": "Active"},
					["name", "member_name", "outstanding", "due_date"],
					order_by="due_date",
				)
			],
		}
	return data


def _trends(month):
	"""Last 12 months of verified collection, oldest first."""
	start = add_months(month, -11)
	rows = frappe.get_all(
		"Monthly Payment",
		filters={"docstatus": 1, "month": [">=", start]},
		fields=[
			"month",
			{"SUM": "saving", "as": "saving"},
			{"SUM": "interest", "as": "interest"},
			{"SUM": "fine", "as": "fine"},
		],
		group_by="month",
	)
	by_month = {getdate(r.month): r for r in rows}
	out = []
	for i in range(12):
		m = getdate(add_months(start, i))
		r = by_month.get(m) or {}
		out.append(
			{"month": m, "saving": flt(r.get("saving")), "interest": flt(r.get("interest")), "fine": flt(r.get("fine"))}
		)
	return {
		"months": out,
		"savings_before": _sum("Monthly Payment", "saving", {"docstatus": 1, "month": ["<", start]})
		+ _sum("Member", "opening_savings", {}),
	}


def _decisions():
	loans = frappe.get_all(
		"Loan",
		{"docstatus": 1, "status": ["in", ["Applied", "Approved"]]},
		["name", "member_name", "amount", "status", "application_date"],
		order_by="application_date",
	)
	for l in loans:
		votes = frappe.get_all("Loan Vote", {"parent": l.name}, pluck="vote")
		l.yes = votes.count("Yes")
		l.no = votes.count("No")
	return loans


def _my_panel(s, month, days_late):
	member = frappe.db.get_value(
		"Member", {"user": frappe.session.user}, ["name", "member_name", "designation", "status"], as_dict=True
	)
	if not member:
		return None

	loans = frappe.get_all(
		"Loan",
		filters={"member": member.name, "status": "Active"},
		fields=["name", "outstanding", "due_date", "disbursed_on"],
		order_by="due_date",
	)
	for l in loans:
		l.days = date_diff(l.due_date, today()) if l.due_date else None
	this_month = frappe.db.get_value(
		"Monthly Payment",
		{"member": member.name, "month": month, "docstatus": ["<", 2]},
		["name", "docstatus", "total"],
		as_dict=True,
	)
	voted = set(frappe.get_all("Loan Vote", {"member": member.name}, pluck="parent"))
	to_vote = [
		l
		for l in frappe.get_all(
			"Loan",
			{"docstatus": 1, "status": "Applied", "member": ["!=", member.name]},
			["name", "member_name", "amount", "application_date"],
			order_by="creation",
		)
		if l.name not in voted
	]
	# same rule as Monthly Payment: interest starts the month after disbursal
	interest = sum(
		flt(l.outstanding) * flt(s.interest_rate) / 100 for l in loans if getdate(l.disbursed_on) < month
	)
	fine = 0 if this_month else calc_fine(days_late, s.late_fine_first_day, s.late_fine_per_day)
	return {
		"name": member.name,
		"member_name": member.member_name,
		"designation": member.designation,
		"savings": flt(frappe.db.get_value("Member", member.name, "opening_savings"))
		+ _sum("Monthly Payment", "saving", {"member": member.name, "docstatus": 1}),
		"loans": loans,
		"loan_total": sum(flt(l.outstanding) for l in loans),
		"this_month": {
			"status": "Paid" if this_month and this_month.docstatus == 1 else "Submitted" if this_month else "Pending",
			"payment": this_month.name if this_month else None,
			"amount": flt(this_month.total) if this_month else flt(s.monthly_saving) + interest + fine,
			"saving": s.monthly_saving,
			"interest": interest,
			"fine": fine,
		},
		"to_vote": to_vote,
	}
