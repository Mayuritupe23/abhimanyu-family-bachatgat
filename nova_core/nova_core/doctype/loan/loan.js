// Copyright (c) 2026, Zuneko and contributors
// For license information, please see license.txt

frappe.ui.form.on("Loan", {
	onload(frm) {
		if (!frm.is_new() || frm.doc.member) return;
		frappe.db.get_value("Member", { user: frappe.session.user }, "name").then((r) => {
			if (r.message && r.message.name) frm.set_value("member", r.message.name);
		});
	},
	refresh(frm) {
		if (frm.doc.status === "Applied" && !frm.is_new()) {
			["Yes", "No"].forEach((vote) =>
				frm.add_custom_button(__("Vote {0}", [__(vote)]), () =>
					frappe
						.xcall("nova_core.nova_core.doctype.loan.loan.cast_vote", { loan: frm.doc.name, vote })
						.then(() => frm.reload_doc())
				)
			);
			if (frappe.user.has_role(["Khajinadar", "System Manager"])) {
				const yes = (frm.doc.votes || []).filter((v) => v.vote === "Yes").length;
				const no = (frm.doc.votes || []).filter((v) => v.vote === "No").length;
				["Approved", "Rejected"].forEach((status) =>
					frm.add_custom_button(
						__(status === "Approved" ? "Approve" : "Reject"),
						() =>
							frappe.confirm(__("Votes: {0} Yes, {1} No. Mark loan as {2}?", [yes, no, __(status)]), () =>
								frappe
									.xcall("nova_core.nova_core.doctype.loan.loan.decide", { loan: frm.doc.name, status })
									.then(() => frm.reload_doc())
							),
						__("Decision")
					)
				);
			}
		}
		if (frm.doc.status === "Approved" && frappe.user.has_role(["Khajinadar", "System Manager"])) {
			frm.add_custom_button(__("Disburse"), () =>
				frappe.confirm(__("Mark {0} as paid to member today?", [format_currency(frm.doc.amount)]), () =>
					frappe
						.xcall("nova_core.nova_core.doctype.loan.loan.disburse", { loan: frm.doc.name })
						.then(() => frm.reload_doc())
				)
			).addClass("btn-primary");
		}
	},
});

