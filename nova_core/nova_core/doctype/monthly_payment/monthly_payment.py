# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import date_diff, flt, get_first_day

from nova_core.gat import calc_fine, check_own_member, due_date, get_settings


class MonthlyPayment(Document):
	def validate(self):
		check_own_member(self.member)
		if frappe.db.get_value("Member", self.member, "status") != "Active":
			frappe.throw(_("Member is not active"))

		self.month = get_first_day(self.month)
		if frappe.db.exists(
			"Monthly Payment",
			{"member": self.member, "month": self.month, "docstatus": ["<", 2], "name": ["!=", self.name]},
		):
			frappe.throw(_("Payment for this month already exists"))
		# members pay by PhonePe and send proof; approvers entering a cash payment need none
		if not self.screenshot and "Khajinadar" not in frappe.get_roles():
			frappe.throw(_("Please attach the payment screenshot"))
		self.calculate()

	def calculate(self):
		s = get_settings()
		self.saving = s.monthly_saving
		self.days_late = max(date_diff(self.payment_date, due_date(self.month, s.due_day)), 0)
		self.fine = calc_fine(self.days_late, s.late_fine_first_day, s.late_fine_per_day)
		self.set_loan_rows(s.interest_rate)

		self.interest = sum(flt(r.interest) for r in self.loans)
		self.principal = sum(flt(r.principal) for r in self.loans)
		self.total = flt(self.saving) + self.interest + self.principal + flt(self.fine)

	def set_loan_rows(self, rate):
		"""Rebuild rows from live loan data, keeping the principal the member typed."""
		principal = {r.loan: flt(r.principal) for r in self.loans}
		self.loans = []
		# Note: interest = rate x outstanding at payment time; a late payment for an old month
		# uses today's outstanding, not that month's. Add per-month accrual if that matters.
		for ln in frappe.get_all(
			"Loan",
			filters={"member": self.member, "status": "Active", "disbursed_on": ["<", self.month]},
			fields=["name", "outstanding"],
			order_by="disbursed_on",
		):
			p = principal.get(ln.name, 0)
			if not 0 <= p <= flt(ln.outstanding):
				frappe.throw(_("Principal for {0} must be between 0 and {1}").format(ln.name, ln.outstanding))
			self.append(
				"loans",
				{
					"loan": ln.name,
					"outstanding": ln.outstanding,
					"interest": flt(ln.outstanding * flt(rate) / 100, 2),
					"principal": p,
				},
			)

	def on_submit(self):
		for r in self.loans:
			left = flt(r.outstanding) - flt(r.principal)
			frappe.db.set_value("Loan", r.loan, {"outstanding": left, "status": "Active" if left > 0 else "Closed"})

	def on_cancel(self):
		for r in self.loans:
			left = flt(frappe.db.get_value("Loan", r.loan, "outstanding")) + flt(r.principal)
			frappe.db.set_value("Loan", r.loan, {"outstanding": left, "status": "Active"})


@frappe.whitelist()
def preview(member, month, payment_date, principals=None):
	"""Live totals for the form: what this member has to pay for the month."""
	check_own_member(member)
	doc = frappe.new_doc("Monthly Payment")
	doc.update({"member": member, "month": get_first_day(month), "payment_date": payment_date})
	for loan, amount in json.loads(principals or "{}").items():
		doc.append("loans", {"loan": loan, "principal": amount})
	doc.calculate()
	return {
		"month": doc.month,
		"loans": [r.as_dict() for r in doc.loans],
		**{f: doc.get(f) for f in ("saving", "interest", "principal", "days_late", "fine", "total")},
	}
