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
					gat.confirm({
						title: vote === "Yes" ? __("Vote YES for this loan?") : __("Vote NO for this loan?"),
						lines: [[__("Member"), frm.doc.member_name], [__("Loan amount"), format_currency(frm.doc.amount)]],
						note: __("You can change your vote until the treasurer decides."),
						ok: vote === "Yes" ? __("Yes, vote YES") : __("Yes, vote NO"),
						danger: vote === "No",
					}).then((yes) => yes && frappe
						.xcall("nova_core.nova_core.doctype.loan.loan.cast_vote", { loan: frm.doc.name, vote })
						.then(() => frm.reload_doc()))
				)
			);
			if (frappe.user.has_role(["Khajinadar", "System Manager"])) {
				const yes = (frm.doc.votes || []).filter((v) => v.vote === "Yes").length;
				const no = (frm.doc.votes || []).filter((v) => v.vote === "No").length;
				["Approved", "Rejected"].forEach((status) =>
					frm.add_custom_button(
						__(status === "Approved" ? "Approve" : "Reject"),
						() =>
							gat.confirm({
								title: status === "Approved" ? __("Approve this loan?") : __("Reject this loan request?"),
								lines: [[__("Member"), frm.doc.member_name], [__("Loan amount"), format_currency(frm.doc.amount)], [__("Votes"), `👍 ${yes} · 👎 ${no}`]],
								note: status === "Approved"
									? __("The member will see the loan as approved. Give the money next, then press Money given.")
									: __("The member will see the request as rejected. This cannot be undone; they can apply again later."),
								ok: status === "Approved" ? __("Yes, approve loan") : __("Yes, reject request"),
								danger: status !== "Approved",
							}).then((ok) => ok && frappe
								.xcall("nova_core.nova_core.doctype.loan.loan.decide", { loan: frm.doc.name, status })
								.then(() => frm.reload_doc())),
						__("Decision")
					)
				);
			}
		}
		if (frm.doc.status === "Approved" && frappe.user.has_role(["Khajinadar", "System Manager"])) {
			frm.add_custom_button(__("Disburse"), () =>
				gat.confirm({
					title: __("Has the loan money been given?"),
					lines: [[__("Member"), frm.doc.member_name], [__("Loan amount"), format_currency(frm.doc.amount)], [__("Date"), frappe.datetime.str_to_user(frappe.datetime.get_today())]],
					note: __("Press this only after the full amount has reached the member. Interest starts from next month and the loan must be closed within 10 months."),
					ok: __("Yes, money given"),
				}).then((ok) => ok && frappe
					.xcall("nova_core.nova_core.doctype.loan.loan.disburse", { loan: frm.doc.name })
					.then(() => frm.reload_doc()))
			).addClass("btn-primary");
		}
	},
});

