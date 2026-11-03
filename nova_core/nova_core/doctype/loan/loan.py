# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_months, flt, fmt_money, now_datetime, today

from nova_core.gat import check_own_member, current_member, get_settings


class Loan(Document):
	def validate(self):
		check_own_member(self.member)
		# state fields only change via submit / cast_vote / decide / disburse / payments
		self.update(dict(status="Draft", application_date=today(), outstanding=0, disbursed_on=None, due_date=None))
		self.votes = []
		if self.get("is_opening"):
			if frappe.db.get_value("Member", self.member, "status") != "Active":
				frappe.throw(_("Member is not active"))
		else:
			check_eligibility(self.member, self.amount, exclude=self.name)

	def before_submit(self):
		if not self.get("is_opening"):
			self.status = "Applied"
			return
		# an old loan comes in already running: no voting, no limit, and no 10-month close rule
		# (that rule started with the app in Nov 2026)
		frappe.only_for(("Khajinadar", "System Manager"))
		self.update(dict(status="Active", disbursed_on=self.opening_date, due_date=None, outstanding=self.amount))

	def before_update_after_submit(self):
		# Frappe lets the owner edit their own doc; only vote/decide/disburse may change a submitted loan
		if not self.flags.via_gat_action:
			frappe.throw(_("Loan cannot be edited after applying"))

	def before_cancel(self):
		if self.status in ("Active", "Closed"):
			frappe.throw(_("A disbursed loan cannot be cancelled"))


def check_eligibility(member, amount, exclude=None):
	if flt(amount) <= 0:
		frappe.throw(_("Loan amount must be more than zero"))
	if frappe.db.get_value("Member", member, "status") != "Active":
		frappe.throw(_("Member is not active"))

	filters = {"member": member, "docstatus": 1, "name": ["!=", exclude or ""]}
	if frappe.db.exists("Loan", dict(filters, status="Active", due_date=["<", today()])):
		frappe.throw(_("An old loan is past its close date. Clear it before taking a new loan."))

	used = sum(
		flt(l.outstanding) if l.status == "Active" else flt(l.amount)
		for l in frappe.get_all(
			"Loan",
			filters=dict(filters, status=["in", ["Applied", "Approved", "Active"]]),
			fields=["status", "amount", "outstanding"],
		)
	)
	limit = flt(get_settings().loan_limit)
	if used + flt(amount) > limit:
		frappe.throw(
			_("Loan limit is {0}. Already taken or applied: {1}. You can apply for up to {2}.").format(
				fmt_money(limit), fmt_money(used), fmt_money(max(limit - used, 0))
			)
		)


@frappe.whitelist()
def cast_vote(loan, vote):
	if vote not in ("Yes", "No"):
		frappe.throw(_("Invalid vote"))
	member = current_member()
	if member.status != "Active":
		frappe.throw(_("Only active members can vote"))

	doc = frappe.get_doc("Loan", loan)
	if doc.status != "Applied":
		frappe.throw(_("Voting is closed for this loan"))

	row = next((r for r in doc.votes if r.member == member.name), None) or doc.append("votes", {"member": member.name})
	row.update({"vote": vote, "voted_on": now_datetime(), "is_office_bearer": int(member.designation != "Member")})
	doc.flags.via_gat_action = True
	doc.save(ignore_permissions=True)


@frappe.whitelist()
def decide(loan, status):
	"""Khajinadar approves or rejects after looking at the votes."""
	frappe.only_for(("Khajinadar", "System Manager"))
	if status not in ("Approved", "Rejected"):
		frappe.throw(_("Invalid status"))
	doc = frappe.get_doc("Loan", loan)
	if doc.status != "Applied":
		frappe.throw(_("Only applied loans can be approved or rejected"))
	doc.status = status
	doc.flags.via_gat_action = True
	doc.save(ignore_permissions=True)


@frappe.whitelist()
def disburse(loan):
	frappe.only_for(("Khajinadar", "System Manager"))
	doc = frappe.get_doc("Loan", loan)
	if doc.status != "Approved":
		frappe.throw(_("Only approved loans can be disbursed"))
	check_eligibility(doc.member, doc.amount, exclude=doc.name)
	doc.update(
		dict(
			status="Active",
			disbursed_on=today(),
			due_date=add_months(today(), get_settings().loan_tenure_months),
			outstanding=doc.amount,
		)
	)
	doc.flags.via_gat_action = True
	doc.save(ignore_permissions=True)
