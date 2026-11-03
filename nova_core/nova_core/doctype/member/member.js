// Copyright (c) 2026, Zuneko and contributors
// For license information, please see license.txt

frappe.ui.form.on("Member", {
	refresh(frm) {
		if (frm.is_new() || frm.doc.user || !frappe.user.has_role(["Khajinadar", "System Manager"])) return;
		frm.add_custom_button(__("Create Login"), () => {
			if (!frm.doc.mobile) return frappe.msgprint(__("Add a mobile number first"));
			frappe.prompt(
				{ fieldname: "password", fieldtype: "Password", label: __("Password"), reqd: 1 },
				({ password }) =>
					frappe
						.xcall("nova_core.nova_core.doctype.member.member.create_login", { member: frm.doc.name, password })
						.then(() => {
							frappe.msgprint(
								__("Login ready. {0} can sign in with mobile {1} and this password.", [frm.doc.member_name, frm.doc.mobile])
							);
							frm.reload_doc();
						}),
				__("Set a password for {0}", [frm.doc.member_name]),
				__("Create")
			);
		}).addClass("btn-primary");
	},
});
