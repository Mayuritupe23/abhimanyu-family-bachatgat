"""API for the AFBG phone app served at /afbg. Every call works for the logged-in member only,
except the approver calls, which check the approver role."""

import json

import frappe
from frappe import _
from frappe.utils import flt, get_first_day, getdate, today

from nova_core.dashboard import get_dashboard
from nova_core.gat import current_member, get_settings, sees_all

APPROVER_ROLES = ("Khajinadar", "System Manager")


def _photos():
	"""Member -> profile photo (the login's User image), for avatars in lists."""
	return dict(frappe.db.sql(
		"select m.name, u.user_image from tabMember m join tabUser u on u.name = m.user where ifnull(u.user_image, '') != ''"
	))


def _is_approver():
	return bool(set(APPROVER_ROLES) & set(frappe.get_roles()))


@frappe.whitelist()
def boot():
	s = get_settings()
	member = frappe.db.get_value(
		"Member", {"user": frappe.session.user}, ["name", "member_name", "designation", "mobile", "status"], as_dict=True
	)
	return {
		"user": frappe.session.user,
		"full_name": frappe.utils.get_fullname(),
		"lang": frappe.local.lang,
		"member": member,
		"photo": frappe.db.get_value("User", frappe.session.user, "user_image"),
		"can_approve": _is_approver(),
		"sees_all": sees_all(),
		"group_name": s.group_name,
		"pay": {"qr": s.payment_qr, "payee": s.payee_name, "upi": s.upi_id},
		"rules": {
			"monthly_saving": s.monthly_saving, "due_day": s.due_day, "fine_first": s.late_fine_first_day,
			"fine_per_day": s.late_fine_per_day, "interest_rate": s.interest_rate, "loan_limit": s.loan_limit,
		},
	}


@frappe.whitelist()
def home():
	data = get_dashboard()
	data["expense_total"] = flt(frappe.db.get_value("Group Expense", {}, [{"SUM": "amount"}]))
	return data


@frappe.whitelist()
def pay_preview(month=None, payment_date=None, principals=None):
	"""What to pay for the month, or the payment already sent for it."""
	from nova_core.nova_core.doctype.monthly_payment.monthly_payment import preview

	member = current_member().name
	month = get_first_day(month or today())
	existing = frappe.db.get_value(
		"Monthly Payment", {"member": member, "month": month, "docstatus": ["<", 2], "is_extra": 0},
		["name", "docstatus", "total", "payment_date"], as_dict=True,
	)
	if existing:
		s = get_settings()
		from nova_core.gat import due_date

		due = due_date(month, s.due_day)
		has_loan = frappe.db.exists("Loan", {"member": member, "status": "Active", "disbursed_on": ["<", month]})
		extras = frappe.get_all(
			"Monthly Payment", {"member": member, "month": month, "is_extra": 1, "docstatus": ["<", 2]},
			["name", "docstatus", "principal", "payment_date"], order_by="payment_date",
		)
		return {
			"existing": existing, "month": month, "due_date": due, "extras": extras,
			# more loan can be repaid for this month until its due date
			"extra_open": bool(has_loan) and getdate(today()) <= getdate(due),
		}
	return preview(member, month, payment_date or today(), principals)


@frappe.whitelist()
def extra_preview(month, principals=None):
	from nova_core.nova_core.doctype.monthly_payment.monthly_payment import preview

	return preview(current_member().name, month, today(), principals, is_extra=1)


@frappe.whitelist()
def submit_extra(month, screenshot, principals, utr=None):
	"""Member sends extra loan repayment for a month already paid (till the due date)."""
	doc = frappe.new_doc("Monthly Payment")
	doc.update({
		"member": current_member().name, "month": get_first_day(month), "payment_date": today(),
		"payment_mode": "UPI", "utr": utr, "screenshot": screenshot, "is_extra": 1,
	})
	for loan, amount in json.loads(principals or "{}").items():
		if flt(amount):
			doc.append("loans", {"loan": loan, "principal": flt(amount)})
	doc.insert()
	return {"name": doc.name, "total": doc.total}


@frappe.whitelist()
def submit_payment(month, payment_date, screenshot, principals=None, utr=None):
	"""Member sends this month's payment for approval (a draft Monthly Payment)."""
	member = current_member().name
	doc = frappe.new_doc("Monthly Payment")
	doc.update({
		"member": member, "month": get_first_day(month), "payment_date": payment_date,
		"payment_mode": "UPI", "utr": utr, "screenshot": screenshot,
	})
	for loan, amount in json.loads(principals or "{}").items():
		doc.append("loans", {"loan": loan, "principal": flt(amount)})
	doc.insert()
	return {"name": doc.name, "total": doc.total}


@frappe.whitelist()
def passbook():
	member = current_member()
	opening = flt(frappe.db.get_value("Member", member.name, "opening_savings"))
	rows = frappe.get_all(
		"Monthly Payment",
		filters={"member": member.name, "docstatus": ["<", 2]},
		fields=["name", "month", "payment_date", "saving", "interest", "principal", "fine", "total", "docstatus", "screenshot", "is_extra"],
		order_by="month desc, is_extra, payment_date",
	)
	paid = [r for r in rows if r.docstatus == 1]
	return {
		"rows": rows,
		"opening": opening,
		"savings": opening + sum(flt(r.saving) for r in paid),
		"interest": sum(flt(r.interest) for r in paid),
		"fines": sum(flt(r.fine) for r in paid),
	}


def _votes(loan, member=None):
	votes = frappe.get_all("Loan Vote", {"parent": loan}, ["member", "vote"])
	return {
		"yes": sum(v.vote == "Yes" for v in votes),
		"no": sum(v.vote == "No" for v in votes),
		"my_vote": next((v.vote for v in votes if v.member == member), None),
	}


def _available(member):
	"""Loan the member can still apply for: limit minus what is running, applied or approved."""
	used = 0
	for l in frappe.get_all(
		"Loan", {"member": member, "docstatus": 1, "status": ["in", ["Applied", "Approved", "Active"]]},
		["status", "amount", "outstanding"],
	):
		used += flt(l.outstanding) if l.status == "Active" else flt(l.amount)
	limit = flt(get_settings().loan_limit)
	return limit, max(limit - used, 0)


@frappe.whitelist()
def loans():
	member = current_member()
	mine = frappe.get_all(
		"Loan",
		filters={"member": member.name, "docstatus": 1},
		fields=["name", "amount", "outstanding", "status", "purpose", "disbursed_on", "due_date", "application_date"],
		order_by="creation desc",
	)
	for l in mine:
		l.repaid = flt(l.amount) - flt(l.outstanding) if l.status in ("Active", "Closed") else 0
		if l.status in ("Applied", "Approved"):
			l.update(_votes(l.name))
	requests = frappe.get_all(
		"Loan",
		filters={"docstatus": 1, "status": "Applied", "member": ["!=", member.name]},
		fields=["name", "member_name", "amount", "purpose", "application_date"],
		order_by="creation",
	)
	photos = _photos()
	for l in requests:
		l.update(_votes(l.name, member.name))
		l.photo = photos.get(frappe.db.get_value("Loan", l.name, "member"))
	overdue = frappe.db.exists("Loan", {"member": member.name, "status": "Active", "due_date": ["<", today()]})
	limit, available = _available(member.name)
	s = get_settings()
	return {
		"mine": mine, "requests": requests, "limit": limit, "available": available,
		"blocked": _("An old loan is past its close date. Clear it first.") if overdue else None,
		"rate": s.interest_rate, "tenure": s.loan_tenure_months,
	}


@frappe.whitelist()
def apply_loan(amount, purpose=None):
	"""Member asks for a loan from the phone. It goes straight to voting (status Applied)."""
	doc = frappe.get_doc({"doctype": "Loan", "member": current_member().name, "amount": flt(amount), "purpose": purpose})
	# members cannot write loans in the desk; here the limit and own-member checks in
	# Loan.validate still run, so skipping the role check is safe
	doc.flags.ignore_permissions = True
	doc.insert()
	doc.submit()
	return loans()


@frappe.whitelist()
def withdraw_loan(loan):
	"""Take back an application nobody has decided on yet."""
	doc = frappe.get_doc("Loan", loan)
	if doc.member != current_member().name or doc.status != "Applied":
		frappe.throw(_("Only your own loan request that is still waiting can be withdrawn"))
	doc.flags.ignore_permissions = True
	doc.cancel()
	return loans()


@frappe.whitelist()
def vote(loan, vote):
	from nova_core.nova_core.doctype.loan.loan import cast_vote

	cast_vote(loan, vote)
	return loans()


@frappe.whitelist()
def approvals():
	frappe.only_for(APPROVER_ROLES)
	return frappe.get_all(
		"Monthly Payment",
		filters={"docstatus": 0},
		fields=["name", "member_name", "month", "payment_date", "saving", "interest", "principal", "fine", "total", "screenshot", "utr"],
		order_by="payment_date",
	)


@frappe.whitelist()
def approve(payment):
	from nova_core.monthly import approve_row

	approve_row(payment)
	return True


@frappe.whitelist()
def reject(payment):
	"""Send a wrong entry back: the member's draft is removed and they can pay again."""
	frappe.only_for(APPROVER_ROLES)
	doc = frappe.get_doc("Monthly Payment", payment)
	if doc.docstatus != 0:
		frappe.throw(_("Only payments waiting for approval can be sent back"))
	frappe.delete_doc("Monthly Payment", payment, ignore_permissions=True)
	return True


@frappe.whitelist()
def set_language(lang):
	if lang not in ("en", "mr"):
		frappe.throw(_("Unknown language"))
	frappe.db.set_value("User", frappe.session.user, "language", lang)
	return lang


@frappe.whitelist()
def gat_month(month=None):
	"""Approver's tracker: every member's state for the month, with what to collect or check."""
	frappe.only_for(APPROVER_ROLES)
	from nova_core.monthly import get_sheet

	sheet = get_sheet(month or today())
	mobiles = dict(frappe.get_all("Member", fields=["name", "mobile"], as_list=True))
	photos = _photos()
	for r in sheet["rows"]:
		r["mobile"] = mobiles.get(r["member"])
		r["photo"] = photos.get(r["member"])
		# what a pending member owes today (fine counted till today)
		if r["state"] == "pending":
			r["due"] = flt(r["saving"]) + flt(r["interest"])
	return sheet


@frappe.whitelist()
def record_payment(member, month, emi=0, utr=None):
	"""Approver enters a UPI payment for a member who paid but did not send it in the app;
	it is approved at once."""
	from nova_core.monthly import save_row

	save_row(member, month, emi=emi, payment_date=today(), payment_mode="UPI")
	return gat_month(month)


@frappe.whitelist()
def gat_loans():
	"""Approver's view of loans: requests to decide, approved ones to pay out, running ones."""
	frappe.only_for(APPROVER_ROLES)
	rows = frappe.get_all(
		"Loan",
		filters={"docstatus": 1, "status": ["in", ["Applied", "Approved", "Active"]]},
		fields=["name", "member", "member_name", "amount", "outstanding", "status", "purpose", "application_date", "disbursed_on", "due_date"],
		order_by="application_date",
	)
	members = frappe.db.count("Member", {"status": "Active"})
	photos = _photos()
	for l in rows:
		l.photo = photos.get(l.member)
		if l.status in ("Applied", "Approved"):
			l.update(_votes(l.name))
	return {"rows": rows, "members": members}


@frappe.whitelist()
def decide_loan(loan, status):
	from nova_core.nova_core.doctype.loan.loan import decide

	decide(loan, status)
	return gat_loans()


@frappe.whitelist()
def disburse_loan(loan):
	from nova_core.nova_core.doctype.loan.loan import disburse

	disburse(loan)
	return gat_loans()


@frappe.whitelist()
def sheet(month=None):
	"""The month's sheet for everyone: what each member has to pay, and the month-end statement."""
	from nova_core.monthly import get_sheet

	data = get_sheet(month or today())
	me = frappe.db.get_value("Member", {"user": frappe.session.user})
	for r in data["rows"]:
		r["me"] = r["member"] == me
		r.pop("screenshot", None)  # members see the sheet, not each other's payment proofs
	return data


@frappe.whitelist()
def expenses():
	rows = frappe.get_all("Group Expense", fields=["name", "date", "amount", "description", "receipt"], order_by="date desc")
	return {"rows": rows, "total": sum(flt(r.amount) for r in rows), "can_add": _is_approver()}


@frappe.whitelist()
def add_expense(date, amount, description, receipt=None):
	frappe.only_for(APPROVER_ROLES)
	file = receipt and frappe.db.get_value("File", {"file_url": receipt, "owner": frappe.session.user}, "name")
	if receipt and not file:
		frappe.throw(_("Please add the bill photo again"))
	doc = frappe.get_doc(
		{"doctype": "Group Expense", "date": date, "amount": flt(amount), "description": description, "receipt": receipt}
	).insert()
	if file:
		# a private file opens for whoever can read the expense it is attached to
		frappe.db.set_value("File", file, {"attached_to_doctype": doc.doctype, "attached_to_name": doc.name, "attached_to_field": "receipt"})
	return expenses()


@frappe.whitelist()
def change_password(old_password, new_password):
	"""Change the member's own password. A wrong current password is reported as a plain error:
	Frappe's own call answers it with an AuthenticationError, which also ends the session."""
	from frappe.core.doctype.user.user import update_password
	from frappe.utils.password import check_password

	try:
		check_password(frappe.session.user, old_password)
	except frappe.AuthenticationError:
		frappe.clear_messages()
		frappe.throw(_("Current password is wrong."))
	return update_password(new_password=new_password, old_password=old_password, logout_all_sessions=0)


@frappe.whitelist()
def hisaab():
	"""The group's whole account in plain steps, for every member: earnings, expenses, where the money is."""
	s = get_settings()

	def total(sql):
		return flt(frappe.db.sql(sql)[0][0])

	paid = "from `tabMonthly Payment` where docstatus=1"
	savings = total(f"select sum(saving) {paid}") + total("select sum(opening_savings) from tabMember")
	interest = total(f"select sum(interest) {paid}")
	fines = total(f"select sum(fine) {paid}")
	repaid = total(f"select sum(principal) {paid}")
	expense = total("select sum(amount) from `tabGroup Expense`")
	given = total("select sum(amount) from tabLoan where docstatus=1 and disbursed_on is not null and is_opening=0")
	loans_out = total("select sum(outstanding) from tabLoan where status='Active'")
	exits = total("select sum(payable) from `tabMember Exit` where docstatus=1")
	opening_earnings = flt(s.opening_earnings)
	earnings = opening_earnings + interest + fines - expense
	cash = flt(s.opening_cash) + total(f"select sum(saving) {paid}") + interest + fines + repaid - given - expense - exits

	months = frappe.db.sql(
		f"""select month, sum(saving) saving, sum(interest) interest, sum(fine) fine, sum(principal) emi
		{paid} group by month order by month desc""",
		as_dict=True,
	)
	return {
		"savings": savings, "interest": interest, "fines": fines, "expense": expense, "opening_earnings": opening_earnings,
		"earnings": earnings, "worth": savings + earnings - exits, "cash": cash, "loans_out": loans_out,
		"given": given, "repaid": repaid, "exits": exits, "months": months,
		"expenses": frappe.get_all("Group Expense", fields=["date", "amount", "description"], order_by="date desc"),
	}


@frappe.whitelist()
def set_photo(file_url=None):
	"""Set or remove the member's own profile photo."""
	frappe.db.set_value("User", frappe.session.user, "user_image", file_url or None)
	return file_url
