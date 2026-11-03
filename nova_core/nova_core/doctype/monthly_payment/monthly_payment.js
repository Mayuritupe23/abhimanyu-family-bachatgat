// Copyright (c) 2026, Zuneko and contributors
// For license information, please see license.txt

// Live totals while the member fills the form: saving + interest + optional extra EMI + fine.
frappe.ui.form.on("Monthly Payment", {
	onload(frm) {
		if (!frm.is_new()) return;
		if (!frm.doc.month) frm.set_value("month", frappe.datetime.get_today());
		if (frm.doc.member) return;
		frappe.db.get_value("Member", { user: frappe.session.user }, "name").then((r) => {
			if (r.message && r.message.name) frm.set_value("member", r.message.name);
		});
	},
	refresh(frm) {
		if (frm.doc.docstatus !== 0) return frm.get_field("pay_here").$wrapper.empty();
		show_intro(frm);
		show_qr(frm);
		if ((frm.doc.loans || []).length) {
			frm.add_custom_button(__("Pay full loan (close it)"), () => {
				frm.doc.loans.forEach((r) => (r.principal = r.outstanding));
				refresh_due(frm);
			});
		}
	},
	member: refresh_due,
	month: refresh_due,
	payment_date: refresh_due,
});

frappe.ui.form.on("Monthly Payment Loan", {
	principal: (frm) => refresh_due(frm),
});

function refresh_due(frm) {
	const d = frm.doc;
	if (d.docstatus !== 0 || !d.member || !d.month || !d.payment_date) return;
	const principals = {};
	(d.loans || []).forEach((r) => (principals[r.loan] = r.principal || 0));
	frappe
		.xcall("nova_core.nova_core.doctype.monthly_payment.monthly_payment.preview", {
			member: d.member,
			month: d.month,
			payment_date: d.payment_date,
			principals: JSON.stringify(principals),
		})
		.then((r) => {
			d.loans = [];
			r.loans.forEach((row) => frm.add_child("loans", { loan: row.loan, outstanding: row.outstanding, interest: row.interest, principal: row.principal }));
			["saving", "interest", "principal", "days_late", "fine", "total"].forEach((f) => (d[f] = r[f]));
			frm.refresh_fields();
			frm.refresh();
		});
}

function show_intro(frm) {
	const d = frm.doc;
	if (!d.total) return frm.set_intro(__("Choose the month. The amount to pay is worked out for you."), "blue");
	const parts = [`${__("Saving")} ${format_currency(d.saving)}`];
	if (d.interest) parts.push(`${__("Interest")} ${format_currency(d.interest)}`);
	if (d.principal) parts.push(`${__("EMI")} ${format_currency(d.principal)}`);
	if (d.fine) parts.push(`${__("Fine")} ${format_currency(d.fine)} (${__("{0} days late", [d.days_late])})`);
	const approver = frappe.user.has_role(["Khajinadar", "System Manager"]) && !frm.is_new();
	frm.set_intro(
		`<b>${__("Pay this month")}: ${format_currency(d.total)}</b> = ${parts.join(" + ")}<br>` +
			(approver
				? __("Check the screenshot and the money, then press Submit to approve.")
				: __("Want to return more of your loan? Type it in EMI. Pay it all to close the loan.")),
		d.fine ? "orange" : "green"
	);
}

// Ratnakar's scanner (Group Settings) with the amount to pay, so members pay from this screen.
function show_qr(frm) {
	frappe.db.get_value("Group Settings", "Group Settings", ["payment_qr", "payee_name", "upi_id"]).then(({ message: g }) => {
		const $w = frm.get_field("pay_here").$wrapper;
		if (!g || (!g.payment_qr && !g.upi_id)) return $w.html(`<div class="text-muted small">${__("Payment scanner not set yet (Group Settings).")}</div>`);
		const amount = frm.doc.total || 0;
		const upi = g.upi_id
			? `upi://pay?pa=${encodeURIComponent(g.upi_id)}&pn=${encodeURIComponent(g.payee_name || "")}&am=${amount}&cu=INR&tn=${encodeURIComponent(
					"Gat " + moment(frm.doc.month).format("MMM YYYY")
			  )}`
			: "";
		$w.html(`
			<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:14px;border:1px solid var(--border-color);
				border-radius:14px;background:linear-gradient(135deg,#f0fdf4,#fffbeb);margin-bottom:8px">
				${g.payment_qr ? `<a href="${g.payment_qr}" target="_blank"><img src="${g.payment_qr}" alt="QR"
					style="width:200px;max-width:100%;border-radius:12px;background:#fff;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.08)"></a>` : ""}
				<div>
					<div style="font-size:12px;color:#64748b;font-weight:600">${__("Scan and pay to")}</div>
					<div style="font-size:18px;font-weight:800;color:#14532d">${frappe.utils.escape_html(g.payee_name || "")}</div>
					${g.upi_id ? `<div style="color:#64748b">${frappe.utils.escape_html(g.upi_id)}</div>` : ""}
					<div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:600">${__("Amount")}</div>
					<div style="font-size:26px;font-weight:800">${format_currency(amount)}</div>
					${upi ? `<a href="${upi}" class="btn btn-primary btn-sm" style="margin-top:8px">${__("Pay in UPI app")}</a>` : ""}
					<div style="margin-top:10px;font-size:12px;color:#b45309">${__("After paying, attach the screenshot below and Save.")}</div>
				</div>
			</div>`);
	});
}
