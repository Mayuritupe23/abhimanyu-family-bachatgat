// One clear confirm box for every desk action that changes money or a decision:
//   gat.confirm({ title, lines: [[label, value]], note, ok, danger }).then((yes) => ...)
frappe.provide("gat");

gat.confirm = function ({ title, lines = [], note = "", ok = __("Yes"), danger = false }) {
	const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
	return new Promise((resolve) => {
		let answered = false;
		const d = new frappe.ui.Dialog({
			title,
			fields: [{ fieldtype: "HTML", fieldname: "body" }],
			primary_action_label: ok,
			primary_action: () => {
				answered = true;
				d.hide();
				resolve(true);
			},
			secondary_action_label: __("Cancel"),
			secondary_action: () => d.hide(),
		});
		const color = danger ? "#dc2626" : "#15803d";
		d.fields_dict.body.$wrapper.html(`
			${lines.length ? `<table style="width:100%;font-size:14px;border-collapse:collapse;background:var(--subtle-fg,#f8fafc);border-radius:10px;overflow:hidden">
				${lines.map(([k, v]) => `<tr><td style="padding:7px 12px;color:var(--text-muted)">${esc(k)}</td>
					<td style="padding:7px 12px;text-align:right;font-weight:700">${esc(v)}</td></tr>`).join("")}</table>` : ""}
			${note ? `<div style="margin-top:12px;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5;
				background:${danger ? "#fef2f2" : "#fffbeb"};color:${danger ? "#991b1b" : "#92400e"}">${esc(note)}</div>` : ""}`);
		d.$wrapper.find(".modal-content")[0].style.setProperty("border-top", `4px solid ${color}`, "important");
		// the theme paints primary buttons with !important, so the colour needs it too
		d.get_primary_btn()[0].style.setProperty("background", color, "important");
		d.onhide = () => !answered && resolve(false);
		d.show();
	});
};
