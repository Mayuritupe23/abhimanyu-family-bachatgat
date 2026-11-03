# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class GroupExpense(Document):
	def validate(self):
		if self.amount <= 0:
			frappe.throw(_("Amount must be more than zero"))
