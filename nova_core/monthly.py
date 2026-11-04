"""Monthly Sheet page: one row per member for a month, like the group's Excel sheet.

Feeds the entry grid, the start-of-month "paise bharna" sheet and the month-end financial
statement that are shared on the WhatsApp group.
"""

import frappe
from frappe import _
from frappe.utils import add_months, flt, get_first_day, today

from nova_core.gat import due_date, get_settings, sees_all


@frappe.whitelist()
def get_sheet(month=None):
	s = get_settings()
	month = get_first_day(month or today())
	next_month = add_months(month, 1)
	members = frappe.get_all(
		"Member",
		filters={"status": "Active", "join_date": ["<", next_month]},
		fields=["name", "member_name"],
		order_by="name",
	)
	payments = {
		p.member: p
		for p in frappe.get_all(
			"Monthly Payment",
			filters={"month": month, "docstatus": ["<", 2], "is_extra": 0},
			fields=["name", "member", "docstatus", "saving", "interest", "principal", "fine", "total", "payment_date", "payment_mode", "screenshot"],
		)
	}
	# extra EMI sent later in the month: approved ones count in the month's EMI, pending ones wait
	extra_paid, extra_waiting = {}, {}
	for x in frappe.get_all(
		"Monthly Payment",
		filters={"month": month, "docstatus": ["<", 2], "is_extra": 1},
		fields=["name", "member", "docstatus", "principal", "payment_date", "screenshot"],
		order_by="payment_date",
	):
		if x.docstatus == 1:
			extra_paid[x.member] = extra_paid.get(x.member, 0) + flt(x.principal)
		else:
			extra_waiting.setdefault(x.member, []).append(x)
	opening_rows = {}
	for r in frappe.get_all(
		"Monthly Payment Loan",
		filters={"parent": ["in", [p.name for p in payments.values()] or [""]]},
		fields=["parent", "outstanding"],
	):
		opening_rows[r.parent] = opening_rows.get(r.parent, 0) + flt(r.outstanding)

	rows = []
	for i, m in enumerate(members, 1):
		p = payments.get(m.name)
		if p:
			opening = opening_rows.get(p.name, 0)
			row = dict(
				saving=flt(p.saving), interest=flt(p.interest), emi=flt(p.principal), fine=flt(p.fine), total=flt(p.total),
				payment=p.name, state="paid" if p.docstatus == 1 else "draft", payment_date=p.payment_date, payment_mode=p.payment_mode,
				screenshot=p.screenshot,
			)
		else:
			opening = _opening_balance(m.name, month)
			row = dict(
				saving=flt(s.monthly_saving), interest=flt(opening * flt(s.interest_rate) / 100, 2), emi=0, fine=0,
				total=0, payment=None, state="pending", payment_date=None, payment_mode=None,
			)
		# like the group's sheets: loans given after the collection show up in next month's opening
		extra = extra_paid.get(m.name, 0)
		row.update(
			no=i, member=m.name, member_name=m.member_name, loan=opening, extra=extra,
			extra_waiting=extra_waiting.get(m.name, []),
			emi=row["emi"] + extra, total=row["total"] + extra, balance=opening - row["emi"] - extra,
		)
		rows.append(row)

	return {
		"month": month,
		"due_date": due_date(month, s.due_day),
		"interest_rate": s.interest_rate,
		"monthly_saving": s.monthly_saving,
		"late_fine_first_day": s.late_fine_first_day,
		"late_fine_per_day": s.late_fine_per_day,
		"group_name": s.group_name,
		"rows": rows,
		"can_enter": bool({"Khajinadar", "System Manager"} & set(frappe.get_roles())),
		"sees_all": sees_all(),
	}


def _opening_balance(member, month):
	"""Principal outstanding on loans that pay interest this month (given before the month)."""
	return flt(
		frappe.db.get_value(
			"Loan", {"member": member, "status": "Active", "disbursed_on": ["<", month]}, [{"SUM": "outstanding"}]
		)
	)


@frappe.whitelist()
def save_row(member, month, emi=0, payment_date=None, payment_mode="UPI"):
	"""Record and verify one member's payment for the month in one step (data-entry users only)."""
	frappe.only_for(("Khajinadar", "System Manager"))
	month = get_first_day(month)
	emi = flt(emi)
	if emi < 0:
		frappe.throw(_("EMI cannot be negative"))

	loans = frappe.get_all(
		"Loan",
		filters={"member": member, "status": "Active", "disbursed_on": ["<", month]},
		fields=["name", "outstanding"],
		order_by="due_date",
	)
	if emi > sum(flt(l.outstanding) for l in loans):
		frappe.throw(_("EMI is more than the loan balance"))

	# spread the EMI over the member's loans, the one closing first gets paid first
	rows, left = [], emi
	for l in loans:
		take = min(left, flt(l.outstanding))
		rows.append({"loan": l.name, "principal": take})
		left -= take

	doc = frappe.get_doc(
		doctype="Monthly Payment",
		member=member,
		month=month,
		payment_date=payment_date or today(),
		payment_mode=payment_mode,
		loans=rows,
	)
	doc.insert()
	doc.submit()
	return doc.name


@frappe.whitelist()
def undo_row(payment):
	"""Cancel a wrongly entered payment so the row can be entered again."""
	frappe.only_for(("Khajinadar", "System Manager"))
	frappe.get_doc("Monthly Payment", payment).cancel()


@frappe.whitelist()
def approve_row(payment):
	"""Approve a payment a member entered (checks done by the approver looking at the screenshot)."""
	frappe.only_for(("Khajinadar", "System Manager"))
	frappe.get_doc("Monthly Payment", payment).submit()
