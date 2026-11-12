// Monthly Sheet: the group's Excel sheet as a page.
//   Entry        - Nitin / Mayuri tick each member's payment as the money reaches Ratnakar
//   Paise Bharna - start-of-month sheet for the WhatsApp group (what each member has to pay)
//   Statement    - month-end financial statement for the WhatsApp group
// Both sheets open as a picture first, then copy / download from there (drawn on a canvas, no library).

const API = "nova_core.monthly";
const MR_MONTHS = ["जानेवारी", "फेब्रुवारी", "मार्च", "एप्रिल", "मे", "जून", "जुलै", "ऑगस्ट", "सप्टेंबर", "ऑक्टोबर", "नोव्हेंबर", "डिसेंबर"];
const mr_digits = (s) => String(s).replace(/\d/g, (d) => "०१२३४५६७८९"[d]);
const num = (v) => Math.round(v || 0).toLocaleString("en-IN");
const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));

frappe.pages["gat-monthly"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({ parent: wrapper, title: __("Monthly Sheet"), single_column: true });
	new GatMonthly(page);
};

class GatMonthly {
	constructor(page) {
		this.page = page;
		this.month = moment().startOf("month");
		this.tab = null;
		this.$body = $(`<div class="gm"></div>`).appendTo(page.body);
		this.add_style();
		this.$body.on("click", "[data-month]", (e) => {
			this.month.add(+e.currentTarget.dataset.month, "months");
			this.load();
		});
		this.$body.on("click", "[data-tab]", (e) => {
			this.tab = e.currentTarget.dataset.tab;
			this.draw();
		});
		this.$body.on("click", "[data-save]", (e) => this.save(e.currentTarget.closest("tr")));
		this.$body.on("click", "[data-undo]", (e) => this.undo(e.currentTarget.dataset.undo));
		this.$body.on("click", "[data-approve]", (e) => {
			e.currentTarget.disabled = true;
			frappe
				.xcall(`${API}.approve_row`, { payment: e.currentTarget.dataset.approve })
				.then(() => {
					frappe.show_alert({ message: __("Approved"), indicator: "green" });
					this.load();
				})
				.catch(() => (e.currentTarget.disabled = false));
		});
		this.$body.on("click", "[data-open]", (e) => frappe.set_route("Form", "Monthly Payment", e.currentTarget.dataset.open));
		this.$body.on("input change", ".gm-entry input, .gm-entry select", (e) => this.preview(e.target.closest("tr")));
		this.$body.on("click", "[data-image]", (e) => this.image(e.currentTarget.dataset.image));
		this.load();
	}

	load() {
		this.$body.html(`<div class="gm-loading">${__("Loading…")}</div>`);
		frappe.xcall(`${API}.get_sheet`, { month: this.month.format("YYYY-MM-DD") }).then((d) => {
			this.data = d;
			if (!this.tab) this.tab = d.can_enter ? "entry" : "demand";
			this.draw();
		});
	}

	draw() {
		const d = this.data;
		const tabs = [
			d.can_enter && ["entry", "✍️", __("Entry")],
			["demand", "📢", __("Paise Bharna")],
			["statement", "📄", __("Statement")],
		].filter(Boolean);
		const body = { entry: () => this.entry(), demand: () => this.demand(), statement: () => this.statement() }[this.tab]();
		this.$body.html(`
			<div class="gm-bar">
				<div class="gm-month">
					<button data-month="-1">‹</button>
					<b>${esc(this.month.format("MMMM YYYY"))}</b>
					<button data-month="1">›</button>
				</div>
				<div class="gm-tabs">${tabs
					.map(([k, ic, l]) => `<button class="${this.tab === k ? "on" : ""}" data-tab="${k}">${ic} ${esc(l)}</button>`)
					.join("")}</div>
			</div>
			${body}`);
	}

	// ------------------------------------------------------------ entry

	entry() {
		const d = this.data;
		const today = frappe.datetime.get_today();
		const done = d.rows.filter((r) => r.state === "paid");
		const sent = d.rows.filter((r) => r.state === "draft").length;
		const got = done.reduce((a, r) => a + r.total, 0);
		const rows = d.rows
			.map((r) => {
				if (r.state === "paid")
					return `<tr class="paid">
					<td>${r.no}</td><td><b>${esc(r.member_name)}</b></td><td>${num(r.loan)}</td><td>${num(r.interest)}</td>
					<td>${num(r.saving)}</td><td>${num(r.emi)}</td>
					<td>${esc(frappe.datetime.str_to_user(r.payment_date))} · ${esc(__(r.payment_mode || ""))}</td>
					<td class="${r.fine ? "red" : ""}">${num(r.fine)}</td><td><b>${num(r.total)}</b></td>
					<td><span class="gm-ok">✔ ${__("Paid")}</span>
						<button class="gm-link" data-undo="${esc(r.payment)}" title="${esc(__("Undo"))}">↺</button></td></tr>`;
				if (r.state === "draft")
					return `<tr class="sent">
					<td>${r.no}</td><td><b>${esc(r.member_name)}</b></td><td>${num(r.loan)}</td><td>${num(r.interest)}</td>
					<td>${num(r.saving)}</td><td>${num(r.emi)}</td>
					<td>${esc(frappe.datetime.str_to_user(r.payment_date))} ${
						r.screenshot ? `· <a href="${esc(r.screenshot)}" target="_blank">🖼 ${__("Screenshot")}</a>` : ""
					}</td>
					<td class="${r.fine ? "red" : ""}">${num(r.fine)}</td><td><b>${num(r.total)}</b></td>
					<td>${
						d.can_enter
							? `<button class="gm-btn" data-approve="${esc(r.payment)}">✔ ${__("Approve")}</button>
								<button class="gm-link" data-open="${esc(r.payment)}" title="${esc(__("Open"))}">↗</button>`
							: `<span class="muted">⏳ ${__("Waiting")}</span>`
					}</td></tr>`;
				return `<tr class="gm-entry" data-member="${esc(r.member)}" data-loan="${r.loan}" data-interest="${r.interest}" data-saving="${r.saving}">
					<td>${r.no}</td><td><b>${esc(r.member_name)}</b></td><td>${num(r.loan)}</td><td>${num(r.interest)}</td><td>${num(r.saving)}</td>
					<td><input type="number" min="0" max="${r.loan}" step="1" class="emi" value="" placeholder="0" ${r.loan ? "" : "disabled"}></td>
					<td class="gm-when"><input type="date" class="date" value="${today}">
</td>
					<td class="fine">0</td><td class="total"><b>0</b></td>
					<td><button class="gm-btn" data-save>✔ ${__("Save")}</button></td></tr>`;
			})
			.join("");
		setTimeout(() => this.$body.find("tr.gm-entry").each((_, tr) => this.preview(tr)));
		return `
			<div class="gm-summary">
				<div><span>${__("Paid")}</span><b>${done.length} / ${d.rows.length}</b></div>
				<div><span>${__("Waiting for approval")}</span><b>${sent}</b></div>
				<div><span>${__("Collected")}</span><b>₹${num(got)}</b></div>
				<div><span>${__("Last date")}</span><b>${esc(frappe.datetime.str_to_user(d.due_date))}</b></div>
				<div><span>${__("Fine after last date")}</span><b>₹${num(d.late_fine_first_day)} + ₹${num(d.late_fine_per_day)}/${__("day")}</b></div>
			</div>
			<div class="gm-card"><table class="gm-table">
				<thead><tr><th>${__("No")}</th><th>${__("Name")}</th><th>${__("Balance Loan")}</th><th>${__("Interest")}</th>
					<th>${__("Monthly")}</th><th>${__("EMI")}</th><th>${__("Paid On")}</th><th>${__("Fine")}</th><th>${__("Total")}</th><th></th></tr></thead>
				<tbody>${rows}</tbody>
			</table></div>
			<p class="muted gm-hint">${__("Blue rows: members sent a payment. Check the screenshot and the money, then Approve. If someone paid on UPI but did not send it in the app, type the EMI and press Save. Fine is added by itself.")}</p>`;
	}

	preview(tr) {
		const d = this.data;
		const $tr = $(tr);
		const late = frappe.datetime.get_day_diff($tr.find(".date").val(), d.due_date);
		const fine = late > 0 ? d.late_fine_first_day + d.late_fine_per_day * (late - 1) : 0;
		const total = +$tr.data("saving") + +$tr.data("interest") + (+$tr.find(".emi").val() || 0) + fine;
		$tr.find(".fine").text(num(fine)).toggleClass("red", fine > 0);
		$tr.find(".total b").text(num(total));
	}

	save(tr) {
		const $tr = $(tr);
		const $btn = $tr.find("[data-save]").prop("disabled", true);
		frappe
			.xcall(`${API}.save_row`, {
				member: $tr.data("member"),
				month: this.month.format("YYYY-MM-DD"),
				emi: +$tr.find(".emi").val() || 0,
				payment_date: $tr.find(".date").val(),
				payment_mode: "UPI",
			})
			.then(() => {
				frappe.show_alert({ message: __("Saved"), indicator: "green" });
				this.load();
			})
			.catch(() => $btn.prop("disabled", false));
	}

	undo(payment) {
		frappe.confirm(__("Cancel this payment? The row will open again for entry."), () =>
			frappe.xcall(`${API}.undo_row`, { payment }).then(() => this.load())
		);
	}

	// ------------------------------------------------------------ shared sheets

	demand_spec() {
		const d = this.data;
		const m = moment(d.month);
		const rows = d.rows.map((r) => [r.no, r.member_name, r.loan, r.interest, r.saving, "", r.saving + r.interest]);
		const sum = (i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
		return {
			title: `${MR_MONTHS[m.month()]} ${mr_digits(m.year())} – या महिन्याचे पैसे भरणा`,
			meta: [`Interest ${d.interest_rate}%`, `Monthly ₹${num(d.monthly_saving)}`, `शेवटची तारीख ${mr_digits(moment(d.due_date).format("DD/MM/YYYY"))}`],
			cols: [
				["NO", "c", 50], ["NAME", "l", 230], ["BALANCE LOAN", "r", 140, "#2563eb"], ["INTEREST", "r", 110],
				["MONTHLY", "r", 110], ["EMI", "r", 100, null, "#fef9c3"], ["TOTAL TO PAY", "r", 140],
			],
			rows,
			total: ["", "TOTAL", sum(2), sum(3), sum(4), "", sum(6)],
			note: "EMI खाना भरा, TOTAL मध्ये EMI जोडा. उशीर झाल्यास दंड लागेल.",
		};
	}

	statement_spec(d = this.data) {
		// only approved payments count; a sent-but-not-approved one shows as not paid yet
		const rows = d.rows.map((r) => {
			const ok = r.state === "paid";
			return [r.no, r.member_name, ok ? r.saving : 0, r.loan, ok ? r.interest : 0,
				ok ? r.emi : 0, ok ? r.fine : 0, ok ? r.total : 0, ok ? r.balance : r.loan];
		});
		const sum = (i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
		const unpaid = d.rows.filter((r) => r.state !== "paid").map((r) => r.member_name);
		return {
			title: "FINANCIAL STATEMENT / REPORT",
			subtitle: `MONTH: ${moment(d.month).format("MMMM YYYY").toUpperCase()}`,
			cols: [
				["NO", "c", 50], ["NAME", "l", 220], ["SHARES", "r", 100], ["LOAN", "r", 110], ["INTEREST", "r", 100],
				["EMI", "r", 100], ["PENALTY", "r", 100], ["TOTAL RE", "r", 110], ["BALANCE LOAN", "r", 130],
			],
			rows,
			total: ["", "TOTAL", sum(2), sum(3), sum(4), sum(5), sum(6), sum(7), sum(8)],
			note: unpaid.length ? `बाकी: ${unpaid.join(", ")}` : "सर्वांनी पैसे भरले ✔",
		};
	}

	sheet_html(spec, kind) {
		const cell = (v, i) => {
			const [, align, , color, bg] = spec.cols[i];
			const txt = typeof v === "number" ? num(v) : esc(v);
			return `<td class="${align}" style="${color ? `color:${color};` : ""}${bg ? `background:${bg};` : ""}">${txt}</td>`;
		};
		return `
			<div class="gm-actions">
				<button class="gm-btn" data-image="one">👁 ${__("View sheet")}</button>
				<button class="gm-btn ghost" data-image="month">📅 ${__("Whole month (both sheets)")}</button>
				<button class="gm-btn ghost" data-image="year">📆 ${__("Whole year (all statements)")}</button>
			</div>
			<div class="gm-card gm-sheet">
				<div class="gm-sheet-title">${esc(spec.title)}</div>
				${spec.subtitle ? `<div class="gm-sheet-sub">${esc(spec.subtitle)}</div>` : ""}
				${spec.meta ? `<div class="gm-sheet-meta">${spec.meta.map((m) => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
				<table class="gm-table sheet">
					<thead><tr>${spec.cols.map(([l]) => `<th>${esc(l)}</th>`).join("")}</tr></thead>
					<tbody>${spec.rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("")}</tbody>
					<tfoot><tr>${spec.total.map((v, i) => `<td class="${spec.cols[i][1]}">${typeof v === "number" ? num(v) : esc(v)}</td>`).join("")}</tr></tfoot>
				</table>
				<div class="gm-sheet-note">${esc(spec.note)}</div>
			</div>`;
	}

	demand() {
		return this.sheet_html(this.demand_spec(), "demand");
	}

	statement() {
		return this.sheet_html(this.statement_spec(), "statement");
	}

	// ------------------------------------------------------------ image

	canvas(spec) {
		const S = 2; // retina
		const pad = 28, rowH = 34, headH = 40;
		const width = spec.cols.reduce((a, c) => a + c[2], 0) + pad * 2;
		const top = pad + 40 + (spec.subtitle ? 26 : 0) + (spec.meta ? 30 : 0) + 10;
		const height = top + headH + rowH * (spec.rows.length + 1) + 50;
		const cv = document.createElement("canvas");
		cv.width = width * S;
		cv.height = height * S;
		const c = cv.getContext("2d");
		c.scale(S, S);
		const font = (w, s) => `${w} ${s}px "Noto Sans Devanagari", "Noto Sans", Arial, sans-serif`;

		c.fillStyle = "#ffffff";
		c.fillRect(0, 0, width, height);
		c.fillStyle = "#14532d";
		c.font = font(800, 24);
		c.textAlign = "center";
		c.fillText(spec.title, width / 2, pad + 24);
		let y = pad + 40;
		if (spec.subtitle) {
			c.fillStyle = "#16a34a";
			c.font = font(700, 16);
			c.fillText(spec.subtitle, width / 2, y + 12);
			y += 26;
		}
		if (spec.meta) {
			c.fillStyle = "#b45309";
			c.font = font(700, 14);
			c.fillText(spec.meta.join("     ·     "), width / 2, y + 14);
			y += 30;
		}
		y = top;

		const xs = [];
		let x = pad;
		spec.cols.forEach((col) => {
			xs.push(x);
			x += col[2];
		});
		const text = (v, i, yy, bold, color) => {
			const [, align, w] = spec.cols[i];
			c.fillStyle = color || "#0f172a";
			c.font = font(bold ? 700 : 500, 14);
			c.textAlign = align === "r" ? "right" : align === "c" ? "center" : "left";
			const tx = align === "r" ? xs[i] + w - 10 : align === "c" ? xs[i] + w / 2 : xs[i] + 10;
			c.fillText(typeof v === "number" ? num(v) : String(v ?? ""), tx, yy);
		};

		// header
		c.fillStyle = "#15803d";
		c.fillRect(pad, y, width - pad * 2, headH);
		spec.cols.forEach((col, i) => text(col[0], i, y + 26, true, "#ffffff"));
		y += headH;

		spec.rows.forEach((r, ri) => {
			c.fillStyle = ri % 2 ? "#f0fdf4" : "#ffffff";
			c.fillRect(pad, y, width - pad * 2, rowH);
			spec.cols.forEach((col, i) => {
				if (col[4]) {
					c.fillStyle = col[4];
					c.fillRect(xs[i], y, col[2], rowH);
				}
			});
			r.forEach((v, i) => text(v, i, y + 22, i === 1 || i === r.length - 1, spec.cols[i][3]));
			y += rowH;
		});

		c.fillStyle = "#dcfce7";
		c.fillRect(pad, y, width - pad * 2, rowH);
		spec.total.forEach((v, i) => text(v, i, y + 22, true, "#14532d"));
		y += rowH;

		// grid
		c.strokeStyle = "#bbf7d0";
		c.lineWidth = 1;
		c.strokeRect(pad, top, width - pad * 2, y - top);
		xs.slice(1).forEach((gx) => {
			c.beginPath();
			c.moveTo(gx, top);
			c.lineTo(gx, y);
			c.stroke();
		});

		c.fillStyle = "#64748b";
		c.font = font(500, 13);
		c.textAlign = "left";
		c.fillText(spec.note, pad, y + 26);
		c.textAlign = "right";
		c.fillText("Abhimanyu Family Bachat Gat", width - pad, y + 26);
		return cv;
	}

	// open the sheet as a picture first; copy / download only from there
	//   one = the sheet on screen, month = Paise Bharna + Statement together
	//   year = the gat year's total + every month's statement (picture: the total; Excel: all tabs)
	image(which) {
		if (which === "year") {
			return frappe.xcall(`${API}.get_year`, { month: this.month.format("YYYY-MM-DD") }).then((y) => {
				const specs = this.year_specs(y);
				this.show(specs, [specs[0]], specs[0].file, __("Whole year") + " · " + specs[0].subtitle.replace("YEAR: ", ""));
			});
		}
		const specs = which === "month" ? [this.demand_spec(), this.statement_spec()]
			: [this.tab === "statement" ? this.statement_spec() : this.demand_spec()];
		const ym = this.month.format("YYYY-MM");
		const name = which === "month" ? `gat-${ym}` : `${this.tab === "statement" ? "statement" : "paise-bharna"}-${ym}`;
		this.show(specs, specs, name, which === "month" ? __("Whole month") + " · " + this.month.format("MMMM YYYY") : specs[0].title);
	}

	year_specs(y) {
		const label = (d) => moment(d).format("MMM YYYY");
		const months = y.sheets.map((d) => Object.assign(this.statement_spec(d), { sheet: label(d.month) }));
		const by = new Map();
		y.sheets.forEach((d) =>
			d.rows.forEach((r) => {
				const ok = r.state === "paid";
				const m = by.get(r.member) || { name: r.member_name, shares: 0, interest: 0, emi: 0, fine: 0, total: 0, months: 0, balance: 0 };
				if (ok) Object.assign(m, { shares: m.shares + r.saving, interest: m.interest + r.interest, emi: m.emi + r.emi,
					fine: m.fine + r.fine, total: m.total + r.total, months: m.months + 1 });
				m.balance = ok ? r.balance : r.loan; // loan left after the last month in the list
				by.set(r.member, m);
			})
		);
		const rows = [...by.values()].map((m, i) => [i + 1, m.name, m.months, m.shares, m.interest, m.emi, m.fine, m.total, m.balance]);
		const sum = (i) => rows.reduce((a, r) => a + (+r[i] || 0), 0);
		const range = `${label(y.start)} – ${label(y.end)}`;
		return [{
			file: `gat-year-${moment(y.start).format("YYYY-MM")}`,
			sheet: "Year Total",
			title: "YEARLY STATEMENT / TOTAL",
			subtitle: `YEAR: ${range.toUpperCase()}`,
			cols: [["NO", "c", 50], ["NAME", "l", 220], ["MONTHS PAID", "r", 110], ["SHARES", "r", 110], ["INTEREST", "r", 110],
				["EMI", "r", 100], ["PENALTY", "r", 100], ["TOTAL PAID", "r", 120], ["BALANCE LOAN", "r", 130, "#2563eb"]],
			rows,
			total: ["", "TOTAL", "", sum(3), sum(4), sum(5), sum(6), sum(7), sum(8)],
			note: `${y.sheets.length} महिने · ${range} · फक्त मंजूर झालेले पैसे`,
		}, ...months];
	}

	// picture of `pics`, Excel of `specs`
	show(specs, pics, name, title) {
		const cv = this.stack(pics.map((sp) => this.canvas(sp)));
		cv.toBlob((blob) => {
			const url = URL.createObjectURL(blob);
			const d = new frappe.ui.Dialog({
				title,
				size: "extra-large",
				fields: [{ fieldtype: "HTML", fieldname: "img" }],
				primary_action_label: "⬇ " + __("Download image"),
				primary_action: () => this.download(blob, `${name}.png`),
				secondary_action_label: "📊 " + __("Download Excel"),
				secondary_action: () =>
					frappe.xcall("nova_core.excel.sheet_xlsx", { specs }).then((b64) => {
						const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
						this.download(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
					}),
			});
			d.fields_dict.img.$wrapper.html(`<div style="max-height:65vh;overflow:auto;border:1px solid var(--border-color);border-radius:10px">
				<img src="${url}" style="display:block;width:100%"></div>`);
			if (navigator.clipboard && window.ClipboardItem)
				d.add_custom_action("📋 " + __("Copy for WhatsApp"), () =>
					navigator.clipboard
						.write([new ClipboardItem({ "image/png": blob })])
						.then(() => frappe.show_alert({ message: __("Image copied. Paste it in the WhatsApp group."), indicator: "green" }))
				);
			d.onhide = () => URL.revokeObjectURL(url);
			d.show();
		});
	}

	stack(cvs) {
		if (cvs.length === 1) return cvs[0];
		const gap = 80;
		const out = document.createElement("canvas");
		out.width = Math.max(...cvs.map((c) => c.width));
		out.height = cvs.reduce((a, c) => a + c.height, 0) + gap * (cvs.length - 1);
		const c = out.getContext("2d");
		c.fillStyle = "#ffffff";
		c.fillRect(0, 0, out.width, out.height);
		let y = 0;
		cvs.forEach((cv, i) => {
			c.drawImage(cv, (out.width - cv.width) / 2, y);
			y += cv.height;
			if (i < cvs.length - 1) {
				c.fillStyle = "#e2e8f0";
				c.fillRect(0, y + gap / 2 - 2, out.width, 4);
				y += gap;
			}
		});
		return out;
	}

	download(blob, file) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = file;
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	}

	// ------------------------------------------------------------ style

	add_style() {
		if (document.getElementById("gm-style")) return;
		$(`<style id="gm-style">
			.gm { padding: 4px 0 30px; font-size: 13px; }
			.gm .muted { color: var(--text-muted); }
			.gm-loading { padding: 40px; text-align: center; color: var(--text-muted); }
			.gm-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
			.gm-month { display: flex; align-items: center; gap: 10px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 4px; }
			.gm-month b { min-width: 130px; text-align: center; font-size: 15px; }
			.gm-month button { border: 0; background: var(--control-bg); width: 30px; height: 30px; border-radius: 8px; font-size: 18px; cursor: pointer; }
			.gm-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
			.gm-tabs button { border: 1px solid var(--border-color); background: var(--card-bg); border-radius: 999px; padding: 6px 14px; font-weight: 700; cursor: pointer; color: var(--text-muted); }
			.gm-tabs button.on { background: #14532d; border-color: #14532d; color: #fff; }
			.gm-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
			.gm-summary > div { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 14px; padding: 10px 14px; border-left: 4px solid #16a34a; }
			.gm-summary span { display: block; font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
			.gm-summary b { font-size: 18px; }
			.gm-card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 6px; overflow-x: auto; }
			.gm-table { width: 100%; border-collapse: collapse; }
			.gm-table th { background: #15803d; color: #fff; font-weight: 700; padding: 9px 10px; text-align: left; white-space: nowrap; font-size: 12px; letter-spacing: .3px; }
			.gm-table th:first-child { border-radius: 10px 0 0 0; } .gm-table th:last-child { border-radius: 0 10px 0 0; }
			.gm-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); white-space: nowrap; }
			.gm-table tbody tr:nth-child(even) td { background: color-mix(in srgb, #16a34a 4%, transparent); }
			.gm-table tr.sent td { background: color-mix(in srgb, #0284c7 8%, transparent) !important; }
			.gm-table tr.paid td { background: color-mix(in srgb, #16a34a 9%, transparent) !important; }
			.gm-table td.r { text-align: right; } .gm-table td.c { text-align: center; }
			.gm-table td.red { color: #dc2626; font-weight: 700; }
			.gm-table input, .gm-table select { height: 30px; border: 1px solid var(--border-color); border-radius: 8px; padding: 0 8px; background: var(--control-bg); }
			.gm-table input.emi { width: 90px; text-align: right; }
			.gm-when { display: flex; gap: 6px; }
			.gm-table tfoot td { font-weight: 800; background: #dcfce7; color: #14532d; }
			.gm-btn { border: 0; border-radius: 10px; padding: 6px 12px; font-weight: 700; background: #16a34a; color: #fff; cursor: pointer; }
			.gm-btn:hover { background: #14532d; } .gm-btn[disabled] { opacity: .5; }
			.gm-btn.ghost { background: var(--control-bg); color: var(--text-color); }
			.gm-link { border: 0; background: none; color: var(--text-muted); cursor: pointer; font-size: 15px; }
			.gm-ok { color: #16a34a; font-weight: 800; }
			.gm-hint { margin-top: 10px; }
			.gm-actions { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
			.gm-sheet { padding: 18px; }
			.gm-sheet-title { text-align: center; font-size: 22px; font-weight: 800; color: #14532d; }
			.gm-sheet-sub { text-align: center; font-weight: 700; color: #16a34a; margin-top: 2px; }
			.gm-sheet-meta { display: flex; justify-content: center; gap: 22px; margin: 8px 0 12px; color: #b45309; font-weight: 700; flex-wrap: wrap; }
			.gm-sheet .gm-table { margin-top: 10px; }
			.gm-sheet-note { margin-top: 10px; color: var(--text-muted); font-size: 12px; }
			@media (max-width: 700px) { .gm-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
		</style>`).appendTo(document.head);
	}
}
