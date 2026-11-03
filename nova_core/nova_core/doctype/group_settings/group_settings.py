# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class GroupSettings(Document):
	def validate(self):
		if not 1 <= self.due_day <= 28:
			frappe.throw(_("Due Day must be between 1 and 28"))
