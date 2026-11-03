// Copyright (c) 2026, Zuneko and contributors
// For license information, please see license.txt

frappe.query_reports["Member Passbook"] = {
	filters: [{ fieldname: "member", label: __("Member"), fieldtype: "Link", options: "Member" }],
};
