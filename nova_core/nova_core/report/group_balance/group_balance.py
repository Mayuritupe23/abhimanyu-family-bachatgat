# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt


def _sum(doctype, field, filters):
	return flt(frappe.db.get_value(doctype, filters, [{"SUM": field}]))


def execute(filters=None):
	paid = {"docstatus": 1}
	saving = _sum("Monthly Payment", "saving", paid)
	interest = _sum("Monthly Payment", "interest", paid)
	fine = _sum("Monthly Payment", "fine", paid)
	principal = _sum("Monthly Payment", "principal", paid)
	# old loans were paid out of the opening cash, before the app
	disbursed = _sum("Loan", "amount", {"disbursed_on": ["is", "set"], "is_opening": 0})
	expense = _sum("Group Expense", "amount", {})
	exits = _sum("Member Exit", "payable", paid)
	outstanding = _sum("Loan", "outstanding", {"status": "Active"})

	opening_cash = flt(frappe.db.get_single_value("Group Settings", "opening_cash"))
	rows = [
		(_("Opening cash"), opening_cash),
		(_("Savings received"), saving),
		(_("Interest received"), interest),
		(_("Fines received"), fine),
		(_("Loan principal repaid"), principal),
		(_("Loans given"), -disbursed),
		(_("Group expenses"), -expense),
		(_("Paid to exited members"), -exits),
		(_("Cash / bank balance"), opening_cash + saving + interest + fine + principal - disbursed - expense - exits),
		(_("Loans outstanding with members"), outstanding),
		(_("Total earnings (interest + fines - expenses)"),
			flt(frappe.db.get_single_value("Group Settings", "opening_earnings")) + interest + fine - expense),
	]
	columns = [
		{"label": _("Head"), "fieldname": "head", "width": 320},
		{"label": _("Amount"), "fieldname": "amount", "fieldtype": "Currency", "width": 160},
	]
	return columns, [{"head": h, "amount": a} for h, a in rows]
