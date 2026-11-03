# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt

from nova_core.gat import current_member, sees_all


def execute(filters=None):
	member = (filters or {}).get("member")
	if not sees_all():
		member = current_member().name

	columns = [
		{"label": _("Month"), "fieldname": "month", "fieldtype": "Date", "width": 110},
		{"label": _("Paid On"), "fieldname": "payment_date", "fieldtype": "Date", "width": 110},
		{"label": _("Saving"), "fieldname": "saving", "fieldtype": "Currency", "width": 110},
		{"label": _("Interest"), "fieldname": "interest", "fieldtype": "Currency", "width": 110},
		{"label": _("Principal"), "fieldname": "principal", "fieldtype": "Currency", "width": 110},
		{"label": _("Fine"), "fieldname": "fine", "fieldtype": "Currency", "width": 100},
		{"label": _("Total Paid"), "fieldname": "total", "fieldtype": "Currency", "width": 120},
		{"label": _("Total Saving"), "fieldname": "total_saving", "fieldtype": "Currency", "width": 130},
		{"label": _("Payment"), "fieldname": "name", "fieldtype": "Link", "options": "Monthly Payment", "width": 140},
	]
	if not member:
		return columns, []

	data = frappe.get_all(
		"Monthly Payment",
		filters={"member": member, "docstatus": 1},
		fields=["name", "month", "payment_date", "saving", "interest", "principal", "fine", "total"],
		order_by="month",
	)
	opening = flt(frappe.db.get_value("Member", member, "opening_savings"))
	if opening:
		data.insert(0, frappe._dict(month=None, saving=opening, name=None, payment_date=None))
	running = 0
	for row in data:
		running += flt(row.saving)
		row.total_saving = running
	return columns, data
