# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import add_months, date_diff, get_first_day, getdate, today

from nova_core.gat import calc_fine, current_member, due_date, get_settings, sees_all


def execute(filters=None):
	s = get_settings()
	columns = [
		{"label": _("Member"), "fieldname": "member", "fieldtype": "Link", "options": "Member", "width": 120},
		{"label": _("Name"), "fieldname": "member_name", "width": 160},
		{"label": _("Month"), "fieldname": "month", "fieldtype": "Date", "width": 110},
		{"label": _("Due Date"), "fieldname": "due_date", "fieldtype": "Date", "width": 110},
		{"label": _("Days Late"), "fieldname": "days_late", "fieldtype": "Int", "width": 90},
		{"label": _("Saving"), "fieldname": "saving", "fieldtype": "Currency", "width": 110},
		{"label": _("Fine Till Today"), "fieldname": "fine", "fieldtype": "Currency", "width": 130},
	]

	member_filters = {"status": "Active"}
	if not sees_all():
		member_filters["name"] = current_member().name
	members = frappe.get_all("Member", filters=member_filters, fields=["name", "member_name", "join_date"])
	paid = {
		(p.member, getdate(p.month))
		for p in frappe.get_all("Monthly Payment", filters={"docstatus": 1}, fields=["member", "month"])
	}

	data = []
	this_month = get_first_day(today())
	for m in members:
		month = get_first_day(max(getdate(m.join_date), getdate(s.group_start_date)))
		while month <= this_month:
			if (m.name, month) not in paid:
				due = due_date(month, s.due_day)
				days = max(date_diff(today(), due), 0)
				data.append(
					dict(
						member=m.name,
						member_name=m.member_name,
						month=month,
						due_date=due,
						days_late=days,
						saving=s.monthly_saving,
						fine=calc_fine(days, s.late_fine_first_day, s.late_fine_per_day),
					)
				)
			month = add_months(month, 1)
	return columns, data
