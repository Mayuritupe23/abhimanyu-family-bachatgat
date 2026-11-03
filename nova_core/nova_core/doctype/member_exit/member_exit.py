# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, fmt_money

from nova_core.gat import earnings_share, get_settings


class MemberExit(Document):
	def validate(self):
		if self.docstatus == 0 and frappe.db.get_value("Member", self.member, "status") != "Active":
			frappe.throw(_("Member has already left"))

		self.total_savings = flt(frappe.db.get_value("Member", self.member, "opening_savings")) + flt(
			frappe.db.get_value("Monthly Payment", {"member": self.member, "docstatus": 1}, [{"SUM": "saving"}])
		)
		self.loan_outstanding = flt(
			frappe.db.get_value("Loan", {"member": self.member, "status": "Active"}, [{"SUM": "outstanding"}])
		)
		years = earnings_share(self.member, get_settings().group_start_date, self.exit_date)
		self.earnings_share = sum(y.share for y in years)
		self.share_details = "\n".join(
			f"Year {y.year} ({y.start} to {y.end}): earnings {fmt_money(y.earnings)}, "
			f"member saving {fmt_money(y.mine)} of {fmt_money(y.total)}, share {fmt_money(y.share)}"
			for y in years
		) or _("No completed group year")
		# Note: unpaid months' dues and fines are not deducted, only loan principal
		self.payable = self.total_savings + self.earnings_share - self.loan_outstanding

	def before_submit(self):
		if self.payable < 0:
			frappe.throw(_("Member owes {0} on loans. Collect it before exit.").format(fmt_money(-self.payable)))

	def on_submit(self):
		frappe.db.set_value("Member", self.member, "status", "Left")
		for ln in frappe.get_all("Loan", {"member": self.member, "status": ["in", ["Applied", "Approved", "Active"]]}, ["name", "status"]):
			if ln.status == "Active":
				frappe.db.set_value("Loan", ln.name, {"outstanding": 0, "status": "Closed"})
			else:
				frappe.db.set_value("Loan", ln.name, "status", "Rejected")

	def on_cancel(self):
		frappe.throw(_("Member Exit cannot be cancelled. Loans were already settled."))
