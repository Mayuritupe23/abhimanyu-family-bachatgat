"""API for the AFBG phone app served at /afbg. Every call works for the logged-in member only,
except the approver calls, which check the approver role."""

import json

import frappe
from frappe import _
from frappe.utils import flt, get_first_day, today

from nova_core.dashboard import get_dashboard
from nova_core.gat import current_member, get_settings, sees_all

APPROVER_ROLES = ("Khajinadar", "System Manager")


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
	return get_dashboard()


@frappe.whitelist()
def pay_preview(month=None, payment_date=None, principals=None):
	"""What to pay for the month, or the payment already sent for it."""
	from nova_core.nova_core.doctype.monthly_payment.monthly_payment import preview

	member = current_member().name
	month = get_first_day(month or today())
	existing = frappe.db.get_value(
		"Monthly Payment", {"member": member, "month": month, "docstatus": ["<", 2]},
		["name", "docstatus", "total", "payment_date"], as_dict=True,
	)
	if existing:
		return {"existing": existing, "month": month}
	return preview(member, month, payment_date or today(), principals)


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
		fields=["name", "month", "payment_date", "saving", "interest", "principal", "fine", "total", "docstatus", "screenshot"],
		order_by="month desc",
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
	for l in requests:
		l.update(_votes(l.name, member.name))
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
	for r in sheet["rows"]:
		r["mobile"] = mobiles.get(r["member"])
		# what a pending member owes today (fine counted till today)
		if r["state"] == "pending":
			r["due"] = flt(r["saving"]) + flt(r["interest"])
	return sheet


@frappe.whitelist()
def record_cash(member, month, emi=0):
	"""Approver records a cash payment handed over in person; it is approved at once."""
	from nova_core.monthly import save_row

	save_row(member, month, emi=emi, payment_date=today(), payment_mode="Cash")
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
	for l in rows:
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
