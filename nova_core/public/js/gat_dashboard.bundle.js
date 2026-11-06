// Gat home dashboard, rendered inside the workspace's "Gat Dashboard" Custom HTML Block.
// It is code, not workspace widgets, so nobody can rearrange or edit it from the desk.
// The block runs in a shadow root: styles are injected here and clicks are routed by our own
// handler (the desk router cannot see clicks inside a shadow root).
// Data: nova_core.dashboard.get_dashboard. Votes: nova_core...loan.cast_vote.

frappe.provide("gat");

const METHOD = "nova_core.dashboard.get_dashboard";
const VOTE = "nova_core.nova_core.doctype.loan.loan.cast_vote";
const esc = (v) => frappe.utils.escape_html(v == null ? "" : String(v));
const money = (v) => format_currency(v || 0, "INR", 0);
const short_money = (v) => {
	v = v || 0;
	const sign = v < 0 ? "-" : "";
	v = Math.abs(v);
	if (v >= 100000) return `${sign}₹${(v / 100000).toFixed(1).replace(/\.0$/, "")}L`;
	if (v >= 1000) return `${sign}₹${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	return `${sign}₹${Math.round(v)}`;
};
const user_date = (d) => frappe.datetime.str_to_user(d);
const days = (n) => (Math.abs(n) === 1 ? __("1 day") : __("{0} days", [Math.abs(n)]));
const initials = (name) =>
	(name || "?")
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0])
		.join("")
		.toUpperCase();
const route_attr = (route, filters) =>
	`data-route='${esc(JSON.stringify(route))}'` +
	(filters ? ` data-filters='${esc(JSON.stringify(filters))}'` : "");
const form = (doctype, name) => route_attr(["Form", doctype, name]);

const STYLE = `
	:host { display: block; --g1: #16a34a; --g2: #14532d; --sf: #f59e0b; --ink: var(--text-color);
		--soft: var(--subtle-accent, #f8fafc); --line: var(--border-color); --card: var(--card-bg); --muted: var(--text-muted); }
	* { box-sizing: border-box; }
	.g { font-size: 13px; color: var(--ink); display: flex; flex-direction: column; gap: 18px; padding-bottom: 8px; }
	.g [data-route] { cursor: pointer; }
	.g button { font: inherit; }
	.muted { color: var(--muted); }
	.loading { color: var(--muted); text-align: center; padding: 40px 0; }

	/* hero */
	.hero { position: relative; overflow: hidden; border-radius: 20px; padding: 22px 26px; color: #fff;
		background: radial-gradient(circle at 92% 0%, rgba(245,158,11,.55), transparent 38%),
			linear-gradient(120deg, var(--g1) 0%, #15803d 45%, var(--g2) 100%);
		box-shadow: 0 14px 34px rgba(20,83,45,.25); display: flex; align-items: center; justify-content: space-between; gap: 18px; }
	.hero .rings { position: absolute; right: -40px; bottom: -90px; width: 320px; height: 320px; opacity: .14; pointer-events: none; }
	.hero h1 { margin: 0; font-size: 26px; font-weight: 800; color: #fff; letter-spacing: -.2px; }
	.hero .sub { margin-top: 4px; font-size: 13px; opacity: .9; }
	.chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
	.chip.role { background: var(--sf); color: #451a03; margin-left: 8px; vertical-align: 4px; }
	.chip.due { margin-top: 14px; background: rgba(255,255,255,.16); color: #fff; padding: 6px 12px; font-size: 12.5px; }
	.chip.due.late { background: #fee2e2; color: #991b1b; }
	.ring { position: relative; width: 132px; height: 132px; flex: none; margin-right: 10px; }
	.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
	.ring .mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
	.ring .mid b { font-size: 26px; line-height: 1; }
	.ring .mid span { font-size: 10.5px; opacity: .9; margin-top: 3px; }
	.refresh { position: absolute; top: 12px; right: 14px; border: 0; background: rgba(255,255,255,.18); color: #fff;
		width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 15px; z-index: 1; }
	.refresh:hover { background: rgba(255,255,255,.3); }

	.brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 12px; font-weight: 700; letter-spacing: .4px; opacity: .95; }
	.brand img { width: 34px; height: 34px; border-radius: 10px; background: #fff; padding: 3px; }
	.brand small { display: block; font-weight: 600; opacity: .85; letter-spacing: 0; }
	.kpis { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
	.kpi { background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; padding: 8px 14px; min-width: 130px; }
	.kpi[data-route]:hover { background: rgba(255,255,255,.22); }
	.kpi span { display: block; font-size: 11px; opacity: .85; font-weight: 600; }
	.kpi b { font-size: 17px; font-weight: 800; white-space: nowrap; }

	/* quick actions */
	.quick { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
	.qa { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--line);
		transition: transform .15s, box-shadow .15s, border-color .15s; }
	.qa:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(15,23,42,.08); border-color: transparent; }
	.qa .qi { width: 40px; height: 40px; flex: none; border-radius: 12px; display: grid; place-items: center; font-size: 19px; background: var(--qa);
		box-shadow: 0 6px 14px -6px var(--qs); }
	.qa > div:last-child { min-width: 0; }
	.qa b, .qa span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.qa b { font-size: 13.5px; line-height: 1.3; }
	.qa span { font-size: 11px; color: var(--muted); }

	.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; align-items: start; }

	/* section title */
	.sec { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
	.sec h3 { margin: 0; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--ink); }
	.sec h3 .ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 14px; background: var(--soft); }
	.pill { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--soft); color: var(--muted); }

	.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 18px; }
	.box { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; min-width: 0; }

	/* bill (my hapta) */
	.bill { position: relative; background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px 18px 16px; overflow: hidden; }
	.bill::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: linear-gradient(90deg, var(--g1), var(--sf)); }
	.bill .ln { display: flex; justify-content: space-between; padding: 6px 0; color: var(--muted); }
	.bill .ln b { color: var(--ink); font-weight: 600; }
	.bill .ln.fine b { color: #dc2626; }
	.bill .cut { border-top: 2px dashed var(--line); margin: 8px -18px; position: relative; }
	.bill .total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 4px; }
	.bill .total span { font-weight: 700; }
	.bill .total b { font-size: 26px; font-weight: 800; }
	.stamp { position: absolute; right: 16px; top: 18px; transform: rotate(-10deg); border: 2px solid; border-radius: 8px;
		padding: 2px 8px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
	.stamp.Paid { color: #16a34a; } .stamp.Submitted { color: #0284c7; } .stamp.Pending { color: #ea580c; } .stamp.Late { color: #dc2626; }
	.cta { display: flex; justify-content: center; align-items: center; gap: 8px; width: 100%; margin-top: 14px; padding: 10px; border: 0; border-radius: 12px;
		font-weight: 800; color: #fff; background: linear-gradient(90deg, var(--g1), var(--g2)); cursor: pointer; box-shadow: 0 6px 14px rgba(22,163,74,.25); }
	.cta:hover { filter: brightness(1.08); }
	.cta.ghost { background: var(--soft); color: var(--ink); box-shadow: none; }

	/* my khata */
	.kv { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.kv > div { padding: 12px 14px; border-radius: 14px; background: var(--soft); }
	.kv .l { font-size: 11.5px; color: var(--muted); font-weight: 600; }
	.kv .v { font-size: 20px; font-weight: 800; margin-top: 2px; }
	.loan { margin-top: 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; }
	.loan .top { display: flex; justify-content: space-between; font-weight: 700; }
	.loan .meta { font-size: 11.5px; color: var(--muted); margin-top: 4px; display: flex; justify-content: space-between; }
	.track { height: 7px; border-radius: 99px; background: var(--soft); margin-top: 8px; overflow: hidden; }
	.track span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--g1), var(--sf)); }
	.track.late span { background: #dc2626; }

	/* wallet strip */
	.wallet { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
	.tile { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; background: var(--card); border: 1px solid var(--line);
		transition: transform .15s, box-shadow .15s; }
	.tile:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(15,23,42,.08); }
	.tile .ic { width: 44px; height: 44px; flex: none; border-radius: 14px; display: grid; place-items: center; font-size: 21px; background: var(--c-bg); }
	.tile .l { font-size: 11.5px; color: var(--muted); font-weight: 600; }
	.tile .v { font-size: 20px; font-weight: 800; color: var(--c); white-space: nowrap; }

	/* avatars, votes */
	.av { width: 38px; height: 38px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #fff;
		background: linear-gradient(135deg, var(--g1), var(--g2)); }
	.vote { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: var(--soft); }
	.vote + .vote { margin-top: 10px; }
	.vote .who { flex: 1; min-width: 0; }
	.vote .who b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.vote .who span { font-size: 11.5px; color: var(--muted); }
	.vbtn { border: 0; border-radius: 10px; padding: 7px 12px; font-weight: 800; cursor: pointer; }
	.vbtn.yes { background: #dcfce7; color: #166534; } .vbtn.yes:hover { background: #bbf7d0; }
	.vbtn.no { background: #fee2e2; color: #991b1b; } .vbtn.no:hover { background: #fecaca; }
	.vbtn[disabled] { opacity: .5; cursor: wait; }

	/* tabs + rows */
	.tabs { display: flex; gap: 6px; flex-wrap: wrap; }
	.tab { border: 1px solid var(--line); background: var(--card); color: var(--muted); border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
	.tab b { margin-left: 4px; padding: 0 6px; border-radius: 99px; background: var(--soft); color: var(--ink); }
	.tab.on { background: var(--g2); color: #fff; border-color: var(--g2); }
	.tab.on b { background: var(--sf); color: #451a03; }
	.tab.hot b { background: #dc2626; color: #fff; }
	.rows { margin-top: 12px; max-height: 300px; overflow-y: auto; overscroll-behavior: contain; }
	.row { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 12px; }
	.row:hover { background: var(--soft); }
	.row .main { flex: 1; min-width: 0; }
	.row .main b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.row .main span { font-size: 11.5px; color: var(--muted); }
	.row .end { text-align: right; flex: none; }
	.row .end b { display: block; }
	.tag { display: inline-block; margin-top: 2px; font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; }
	.tag.red { background: #fee2e2; color: #991b1b; } .tag.orange { background: #ffedd5; color: #9a3412; }
	.tag.green { background: #dcfce7; color: #166534; } .tag.gray { background: var(--soft); color: var(--muted); }
	.clear { padding: 26px 8px; text-align: center; color: #16a34a; font-weight: 700; }
	.clear span { display: block; font-size: 26px; margin-bottom: 4px; }

	/* roster */
	.roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 12px; }
	.mem { text-align: center; }
	.mem .av { margin: 0 auto; width: 46px; height: 46px; font-size: 14px; position: relative; }
	.mem.pending .av { background: var(--soft); color: var(--muted); border: 2px dashed var(--line); }
	.mem.submitted .av { background: linear-gradient(135deg, #38bdf8, #0369a1); }
	.mem .av i { position: absolute; right: -2px; bottom: -2px; width: 18px; height: 18px; border-radius: 50%; font-style: normal; font-size: 10px;
		display: grid; place-items: center; background: #fff; color: #166534; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
	.mem .nm { margin-top: 6px; font-size: 11px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--muted); }
	.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }

	/* charts */
	.chart-note { font-size: 12.5px; color: var(--muted); margin: 2px 0 14px; }
	.chart-note b { color: var(--ink); }
	.bars { display: flex; align-items: flex-end; gap: 10px; height: 190px; padding-top: 18px; }
	.bar { flex: 1 1 0; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; }
	.bar .stack { width: min(34px, 100%); display: flex; flex-direction: column-reverse; border-radius: 10px; overflow: hidden; min-height: 4px; background: var(--soft); transition: transform .15s; }
	.bar:hover .stack { transform: translateY(-3px); }
	.bar .stack span { display: block; }
	.bar .lb { margin-top: 6px; font-size: 11px; color: var(--muted); }
	.bar.now .lb { color: var(--ink); font-weight: 800; }
	.tip { display: none; position: absolute; bottom: calc(100% - 6px); left: 50%; transform: translateX(-50%); z-index: 3; background: #0f172a; color: #fff;
		border-radius: 10px; padding: 8px 10px; font-size: 11.5px; white-space: nowrap; box-shadow: 0 8px 20px rgba(0,0,0,.18); line-height: 1.6; }
	.bar:hover .tip, .dot:hover .tip { display: block; }
	.bar:first-child .tip, .dot.l .tip { left: 0; transform: none; }
	.bar:last-child .tip, .dot.r .tip { left: auto; right: 0; transform: none; }
	.tip i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }
	.area { position: relative; height: 200px; }
	.area svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
	.dot { position: absolute; width: 12px; height: 12px; margin: 0 0 -6px -6px; border-radius: 50%; background: var(--card); border: 3px solid var(--g1); }
	.dot .tip { bottom: 16px; }
	.xl { position: relative; height: 18px; margin-top: 8px; }
	.xl div { position: absolute; transform: translateX(-50%); font-size: 11px; color: var(--muted); }
	.donut-wrap { display: grid; grid-template-columns: 190px minmax(0, 1fr); gap: 22px; align-items: center; }
	.donut { position: relative; width: 190px; height: 190px; }
	.donut svg { width: 100%; height: 100%; transform: rotate(-90deg); }
	.donut circle { fill: none; stroke-width: 6; }
	.donut .mid { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
	.donut .mid b { font-size: 22px; } .donut .mid span { font-size: 11px; color: var(--muted); }
	.key { display: grid; grid-template-columns: 12px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px; }
	.key:hover { background: var(--soft); }
	.key i { width: 12px; height: 12px; border-radius: 4px; }

	/* hisaab */
	.hisaab { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
	.hcard { position: relative; }
	.hcard h4 { margin: 0 0 10px; font-size: 14px; font-weight: 800; color: var(--ink); }
	.hstep { position: absolute; top: 14px; right: 14px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
		color: #fff; font-weight: 800; font-size: 12px; background: linear-gradient(140deg, #22c55e, #15803d); }
	.hl { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; color: var(--muted); }
	.hl b { color: var(--ink); white-space: nowrap; }
	.hl.plus b { color: #15803d; } .hl.minus b { color: #dc2626; }
	.hl.link span { color: #15803d; font-weight: 700; cursor: pointer; }
	.hl.tot span { color: var(--ink); font-weight: 800; } .hl.tot b { font-size: 18px; }
	.hdiv { border-top: 2px dashed var(--line); margin: 6px 0; }
	.hworth { font-size: 26px; font-weight: 800; text-align: right; color: var(--ink); }
	.hnote { margin: 8px 0 0; font-size: 11.5px; color: var(--muted); background: #fffbeb; border-radius: 10px; padding: 8px 10px; }
	.hsplit { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--soft); margin-bottom: 6px; }
	.hok { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; }
	.hok.bad { background: #fee2e2; color: #991b1b; }
	@media (max-width: 1200px) { .three { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .three > :last-child { grid-column: 1 / -1; } }
	@media (max-width: 1000px) { .hisaab, .three { grid-template-columns: minmax(0, 1fr); } }
	@media (max-width: 1000px) { .two { grid-template-columns: minmax(0, 1fr); } .wallet { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 560px) {
		.hero { flex-direction: column; align-items: flex-start; padding: 20px; }
		.hero h1 { font-size: 20px; }
		.wallet, .kv { grid-template-columns: minmax(0, 1fr); }
		.bars { gap: 4px; } .bar .lb { font-size: 9.5px; }
		.xl div:nth-child(even) { visibility: hidden; }
		.donut-wrap { grid-template-columns: minmax(0, 1fr); justify-items: center; }
	}
`;

const RINGS = `<svg class="rings" viewBox="0 0 100 100"><g fill="none" stroke="#fff" stroke-width="2">
	<circle cx="50" cy="50" r="46" stroke-dasharray="14 6"/><circle cx="50" cy="50" r="36" stroke-dasharray="10 5"/>
	<circle cx="50" cy="50" r="26" stroke-dasharray="7 4"/><circle cx="50" cy="50" r="16"/></g></svg>`;

const sec = (icon, title, right = "") =>
	`<div class="sec"><h3><span class="ic">${icon}</span>${esc(title)}</h3>${right}</div>`;
const clear = (msg, icon = "🎉") => `<div class="clear"><span>${icon}</span>${esc(msg)}</div>`;

// ------------------------------------------------------------------ hero

function hero(d) {
	const me = d.me;
	const name = me ? me.member_name.split(" ")[0] : frappe.session.user_fullname;
	const role = me && me.designation && me.designation !== "Shareholder" ? `<span class="chip role">${esc(__(me.designation))}</span>` : "";
	const g = d.group;
	const late = d.days_to_due < 0;
	const due = late
		? __("Last date {0} passed · fine is running", [user_date(d.due_date)])
		: d.days_to_due === 0
		? __("Today is the last date!")
		: __("Last date {0} · {1} left", [user_date(d.due_date), days(d.days_to_due)]);
	const pct = g.members ? g.paid_this_month / g.members : 0;
	return `<div class="hero">
		${RINGS}
		<button class="refresh" data-refresh title="${esc(__("Refresh"))}">⟳</button>
		<div>
			<div class="brand"><img src="/assets/nova_core/images/emblem.svg" alt="">
				<div>${esc(d.group_name || "Abhimanyu Bachat Gat")}<small>अभिमन्यू बचत गट · एकत्र बचत, एकत्र प्रगती</small></div></div>
			<h1>${esc(__("Namaskar"))}, ${esc(name)} 🙏${role}</h1>
			<div class="sub">${esc(moment(d.month).format("MMMM YYYY"))}</div>
			<span class="chip due ${late ? "late" : ""}">📅 ${esc(due)}</span>
			<div class="kpis">
				<div class="kpi"><span>${esc(__("Total money of the Gat"))}</span><b>${money(g.savings + g.earnings - g.exits)}</b></div>
				<div class="kpi"><span>${esc(__("Members' savings"))}</span><b>${money(g.savings)}</b></div>
				<div class="kpi" ${route_attr(["List", "Loan"], { status: "Active" })}><span>${esc(__("With members as loans"))}</span><b>${money(g.loans_out)}</b></div>
				<div class="kpi" ${route_attr(["query-report", "Group Balance"])}><span>${esc(__("With the group (bank / UPI)"))}</span><b>${money(g.cash)}</b></div>
			</div>
		</div>
		<div class="ring" title="${esc(__("Members paid this month"))}">
			<svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="4"/>
				<circle cx="21" cy="21" r="17" fill="none" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"
					stroke-dasharray="${(pct * 106.8).toFixed(1)} 106.8"/></svg>
			<div class="mid"><b>${g.paid_this_month}/${g.members}</b><span>${esc(__("paid this month"))}</span></div>
		</div>
	</div>`;
}

// ------------------------------------------------------------------ quick actions

function quick(d) {
	const tiles = [
		d.me && ["💸", __("Pay hapta"), __("This month's payment"), ["Form", "Monthly Payment", "new"], "#dcfce7", "#16a34a"],
		["📋", __("Monthly Sheet"), __("Paise Bharna & Statement"), ["gat-monthly"], "#dbeafe", "#2563eb"],
		d.me && ["📒", __("My Passbook"), __("Every entry of mine"), ["query-report", "Member Passbook"], "#fef3c7", "#d97706"],
		d.me && ["🤝", __("Apply for loan"), __("Ask the Gat for a loan"), ["Form", "Loan", "new"], "#ffedd5", "#ea580c"],
		["🏦", __("Loans"), __("All loans & votes"), ["List", "Loan"], "#ede9fe", "#7c3aed"],
		["🧾", __("Expenses"), __("Group expenses"), ["List", "Group Expense"], "#fce7f3", "#db2777"],
		d.is_admin && ["⏰", __("Pending Dues"), __("Who has not paid"), ["query-report", "Pending Dues"], "#fee2e2", "#dc2626"],
		d.is_admin && ["⚖️", __("Group Balance"), __("Cash & bank"), ["query-report", "Group Balance"], "#cffafe", "#0891b2"],
		d.is_admin && ["👥", __("Members"), __("All members"), ["List", "Member"], "#e0e7ff", "#4f46e5"],
	].filter(Boolean);
	return `<div class="quick">${tiles
		.map(
			([ic, t, sub, route, bg, sh]) => `<div class="qa" ${route_attr(route)} style="--qa:${bg};--qs:${sh}">
			<div class="qi">${ic}</div><div><b>${esc(t)}</b><span>${esc(sub)}</span></div></div>`
		)
		.join("")}</div>`;
}

// ------------------------------------------------------------------ me

function bill(d) {
	const tm = d.me.this_month;
	const late = tm.status === "Pending" && d.days_to_due < 0;
	const stamp = late ? "Late" : tm.status;
	const stamp_text = { Paid: __("Paid"), Submitted: __("Sent"), Pending: __("Due"), Late: __("Late") }[stamp];
	const lines = [
		`<div class="ln"><span>${esc(__("Saving"))}</span><b>${money(tm.saving)}</b></div>`,
		tm.interest ? `<div class="ln"><span>${esc(__("Loan interest"))}</span><b>${money(tm.interest)}</b></div>` : "",
		tm.fine ? `<div class="ln fine"><span>${esc(__("Late fine"))}</span><b>${money(tm.fine)}</b></div>` : "",
	].join("");
	const button =
		tm.status === "Pending"
			? `<button class="cta" ${route_attr(["Form", "Monthly Payment", "new"])}>${esc(__("Pay now"))} →</button>`
			: `<button class="cta ghost" ${form("Monthly Payment", tm.payment)}>${esc(
					tm.status === "Paid" ? __("View receipt") : __("Sent, waiting for approval")
			  )}</button>`;
	return `<div class="bill">
		${sec("🧾", __("My Hapta"))}
		<span class="stamp ${stamp}">${esc(stamp_text)}</span>
		${lines}
		<div class="cut"></div>
		<div class="total"><span>${esc(__("Total"))}</span><b>${money(tm.amount)}</b></div>
		${button}
	</div>`;
}

function khata(d) {
	const me = d.me;
	const loans = me.loans
		.map((l) => {
			if (l.days == null)
				return `<div class="loan" ${form("Loan", l.name)}>
				<div class="top"><span>${esc(l.name)}</span><span>${money(l.outstanding)}</span></div>
				<div class="meta"><span>${esc(__("Old loan, no close date"))}</span></div></div>`;
			const span = 300; // ~10 months of loan life
			const used = Math.min(Math.max(span - l.days, 0), span);
			const late = l.days < 0;
			return `<div class="loan" ${form("Loan", l.name)}>
				<div class="top"><span>${esc(l.name)}</span><span>${money(l.outstanding)}</span></div>
				<div class="track ${late ? "late" : ""}"><span style="width:${(used / span) * 100}%"></span></div>
				<div class="meta"><span>${esc(__("Close by {0}", [user_date(l.due_date)]))}</span>
					<span>${late ? `<span class="tag red">${esc(__("overdue"))}</span>` : esc(__("{0} left", [days(l.days)]))}</span></div>
			</div>`;
		})
		.join("");
	const none = `<div class="muted" style="margin-top:12px">${esc(__("No active loan. Need one?"))}
		<span ${route_attr(["Form", "Loan", "new"])} style="color:var(--g1);font-weight:700">${esc(__("Apply"))} →</span></div>`;
	return `<div class="box">
		${sec("📒", __("My Khata"), `<span class="pill" ${route_attr(["query-report", "Member Passbook"])}>${esc(__("Passbook"))} →</span>`)}
		<div class="kv">
			<div ${route_attr(["query-report", "Member Passbook"])}><div class="l">${esc(__("My savings"))}</div>
				<div class="v" style="color:var(--g1)">${money(me.savings)}</div></div>
			<div ${route_attr(["List", "Loan"], { member: me.name })}><div class="l">${esc(__("My loan"))}</div>
				<div class="v" style="color:#ea580c">${money(me.loan_total)}</div></div>
		</div>
		${loans || (d.can_enter ? none : `<div class="muted" style="margin-top:12px">${esc(__("No active loan"))}</div>`)}
	</div>`;
}

function votes(d) {
	const list = d.me.to_vote;
	const body = list.length
		? list
				.map(
					(l) => `<div class="vote">
				<div class="av">${esc(initials(l.member_name))}</div>
				<div class="who" ${form("Loan", l.name)}><b>${esc(l.member_name)} · ${money(l.amount)}</b>
					<span>${esc(__("Applied {0}", [user_date(l.application_date)]))}</span></div>
				<button class="vbtn yes" data-vote="Yes" data-loan="${esc(l.name)}">👍 ${esc(__("Yes"))}</button>
				<button class="vbtn no" data-vote="No" data-loan="${esc(l.name)}">👎 ${esc(__("No"))}</button>
			</div>`
				)
				.join("")
		: clear(__("No loan request waiting for your vote"), "🗳️");
	return `<div class="box">${sec("🗳️", __("Loan Requests"), list.length ? `<span class="pill">${list.length}</span>` : "")}${body}</div>`;
}

// ------------------------------------------------------------------ group

// the group's account, same three steps as the phone app's Hisaab screen, in full rupees
function wallet(d) {
	const g = d.group;
	const worth = g.cash + g.loans_out;
	const line = (label, value, cls = "", route) =>
		`<div class="hl ${cls}" ${route ? route_attr(route) : ""}><span>${esc(label)}</span><b>${value}</b></div>`;
	const cashPct = worth ? (g.cash / worth) * 100 : 0;
	return `<div>${sec("⚖️", __("Gat ka Hisaab"))}
		<div class="hisaab">
			<div class="box hcard">
				<div class="hstep">1</div><h4>${esc(__("What the Gat earned"))}</h4>
				${line(__("Interest from loans"), "+ " + money(g.interest), "plus")}
				${line(__("Late fines"), "+ " + money(g.fines), "plus")}
				${g.opening_earnings ? line(__("Earned before the app"), "+ " + money(g.opening_earnings), "plus") : ""}
				${line(__("Minus group expenses") + " →", "− " + money(g.expense), "minus link", ["List", "Group Expense"])}
				<div class="hdiv"></div>
				${line(__("Earnings after expenses"), money(g.earnings), "tot")}
				<p class="hnote">${esc(__("Expenses are taken out of the earnings, never out of anyone's savings."))}</p>
			</div>
			<div class="box hcard">
				<div class="hstep">2</div><h4>${esc(__("Total money of the Gat"))}</h4>
				${line(__("Members' savings"), money(g.savings))}
				${line(__("Earnings after expenses"), "+ " + money(g.earnings), "plus")}
				${g.exits ? line(__("Paid to members who left"), "− " + money(g.exits), "minus") : ""}
				<div class="hdiv"></div>
				<div class="hworth">${money(g.savings + g.earnings - g.exits)}</div>
			</div>
			<div class="box hcard">
				<div class="hstep">3</div><h4>${esc(__("Where this money is now"))}</h4>
				<div class="hsplit"><span style="width:${cashPct}%;background:#22c55e"></span><span style="width:${100 - cashPct}%;background:#f59e0b"></span></div>
				${line("🟩 " + __("With the group (bank / UPI)"), money(g.cash), "", ["query-report", "Group Balance"])}
				${line("🟧 " + __("With members as loans") + " →", money(g.loans_out), "link", ["List", "Loan"], )}
				<div class="hdiv"></div>
				${line(__("Total"), money(worth), "tot")}
				<div class="hok ${Math.round(worth) === Math.round(g.savings + g.earnings - g.exits) ? "" : "bad"}">${
					Math.round(worth) === Math.round(g.savings + g.earnings - g.exits)
						? "✓ " + esc(__("Both totals match. The account is correct."))
						: "⚠ " + esc(__("Totals do not match. Please tell the treasurer."))
				}</div>
			</div>
		</div></div>`;
}

// ------------------------------------------------------------------ office bearers

function action_center(d, state) {
	const a = d.admin;
	const tabs = [
		["verify", "✅", __("Verify"), a.to_verify.length, a.to_verify.length > 0],
		["decide", "⚖️", __("Loan decisions"), a.decisions.length, false],
		["unpaid", "⏰", __("Not paid"), a.unpaid.length, a.days_late > 0 && a.unpaid.length > 0],
		["loans", "🤝", __("Active loans"), a.loans_due.length, a.loans_due.some((l) => l.days != null && l.days < 0)],
	];
	const rows = {
		verify: () =>
			a.to_verify.map(
				(p) => `<div class="row" ${form("Monthly Payment", p.name)}>
				<div class="av">${esc(initials(p.member_name))}</div>
				<div class="main"><b>${esc(p.member_name)}</b><span>${esc(moment(p.month).format("MMM YYYY"))} · ${esc(
					__("paid on {0}", [user_date(p.payment_date)])
				)}</span></div>
				<div class="end"><b>${money(p.total)}</b>${
					p.days_late
						? `<span class="tag red">${esc(__("{0} late", [days(p.days_late)]))}</span>`
						: `<span class="tag green">${esc(__("on time"))}</span>`
				}</div></div>`
			),
		decide: () =>
			a.decisions.map(
				(l) => `<div class="row" ${form("Loan", l.name)}>
				<div class="av">${esc(initials(l.member_name))}</div>
				<div class="main"><b>${esc(l.member_name)} · ${money(l.amount)}</b><span>👍 ${l.yes} · 👎 ${l.no}</span></div>
				<div class="end">${
					l.status === "Approved"
						? `<span class="tag green">${esc(__("Ready to disburse"))}</span>`
						: `<span class="tag orange">${esc(__("Approve / Reject"))}</span>`
				}</div></div>`
			),
		unpaid: () =>
			a.unpaid.map(
				(m) => `<div class="row" ${route_attr(["query-report", "Pending Dues"])}>
				<div class="av" style="background:var(--soft);color:var(--muted)">${esc(initials(m.member_name))}</div>
				<div class="main"><b>${esc(m.member_name)}</b><span>${esc(m.name)}</span></div>
				<div class="end">${
					m.fine
						? `<span class="tag red">${esc(__("fine"))} ${money(m.fine)}</span>`
						: `<span class="tag gray">${esc(__("not yet due"))}</span>`
				}</div></div>`
			),
		loans: () =>
			a.loans_due.map(
				(l) => `<div class="row" ${form("Loan", l.name)}>
				<div class="av">${esc(initials(l.member_name))}</div>
				<div class="main"><b>${esc(l.member_name)}</b><span>${esc(l.name)} · ${esc(
					l.due_date ? __("close by {0}", [user_date(l.due_date)]) : __("old loan, no close date")
				)}</span></div>
				<div class="end"><b>${money(l.outstanding)}</b>${
					l.days == null
						? `<span class="tag gray">${esc(__("old rule"))}</span>`
						: l.days < 0
						? `<span class="tag red">${esc(__("overdue"))}</span>`
						: `<span class="tag ${l.days <= 30 ? "orange" : "gray"}">${esc(__("{0} left", [days(l.days)]))}</span>`
				}</div></div>`
			),
	};
	const empty = {
		verify: __("All payments verified"),
		decide: __("No loan waiting for a decision"),
		unpaid: __("Everyone has paid this month"),
		loans: __("No active loan"),
	};
	const list = rows[state.action]();
	return `<div class="box">
		${sec("⚡", __("Action Center"))}
		<div class="tabs">${tabs
			.map(
				([k, ic, l, n, hot]) =>
					`<button class="tab ${state.action === k ? "on" : ""} ${hot ? "hot" : ""}" data-action="${k}">${ic} ${esc(l)}<b>${n}</b></button>`
			)
			.join("")}</div>
		<div class="rows">${list.join("") || clear(empty[state.action])}</div>
	</div>`;
}

function roster(d) {
	const legend = `<div class="legend"><span><i style="background:#16a34a"></i>${esc(__("Paid"))}</span>
		<span><i style="background:#0284c7"></i>${esc(__("Sent"))}</span><span><i style="background:#cbd5e1"></i>${esc(__("Pending"))}</span></div>`;
	return `<div class="box">
		${sec("🧑‍🤝‍🧑", __("This Month's Board"), legend)}
		<div class="roster">${d.admin.roster
			.map(
				(m) => `<div class="mem ${m.state}" ${form("Member", m.name)} title="${esc(m.member_name)}">
				<div class="av">${esc(initials(m.member_name))}${m.state === "paid" ? "<i>✔</i>" : m.state === "submitted" ? "<i>⏳</i>" : ""}</div>
				<div class="nm">${esc(m.member_name.split(" ")[0])}</div></div>`
			)
			.join("")}</div>
	</div>`;
}

// ------------------------------------------------------------------ charts

const C = { saving: "#16a34a", interest: "#0284c7", fine: "#f59e0b" };
const LOAN_C = { Applied: "#f59e0b", Approved: "#8b5cf6", Active: "#ea580c", Closed: "#16a34a", Rejected: "#94a3b8" };

function bars(t, month) {
	const ms = t.months;
	const tot = ms.map((m) => m.saving + m.interest + m.fine);
	const max = Math.max(...tot, 1);
	const sum = tot.reduce((a, b) => a + b, 0);
	return `<div class="chart-note">${__("Collected {0} in 12 months", [`<b>${money(sum)}</b>`])}</div>
		<div class="bars">${ms
			.map((m) => {
				const h = (v) => (v / max) * 150;
				return `<div class="bar ${m.month === month ? "now" : ""}">
				<div class="tip"><b>${esc(moment(m.month).format("MMMM YYYY"))}</b><br>
					<i style="background:${C.saving}"></i>${esc(__("Saving"))} ${money(m.saving)}<br>
					<i style="background:${C.interest}"></i>${esc(__("Interest"))} ${money(m.interest)}<br>
					<i style="background:${C.fine}"></i>${esc(__("Fine"))} ${money(m.fine)}</div>
				<div class="stack">${["saving", "interest", "fine"]
					.map((k) => (m[k] ? `<span style="height:${h(m[k])}px;background:${C[k]}"></span>` : ""))
					.join("")}</div>
				<div class="lb">${esc(moment(m.month).format("MMM"))}</div></div>`;
			})
			.join("")}</div>`;
}

function growth(t) {
	let run = t.savings_before;
	const pts = t.months.map((m) => (run += m.saving));
	const max = Math.max(...pts, 1);
	const n = pts.length;
	const x = (i) => (i / (n - 1)) * 100;
	const y = (v) => 96 - (v / max) * 88;
	// smooth curve: cubic segments with both control points at the mid x
	let path = `M ${x(0)} ${y(pts[0])}`;
	for (let i = 1; i < n; i++) {
		const mx = (x(i - 1) + x(i)) / 2;
		path += ` C ${mx} ${y(pts[i - 1])}, ${mx} ${y(pts[i])}, ${x(i)} ${y(pts[i])}`;
	}
	const dots = pts
		.map(
			(v, i) => `<div class="dot ${i < 2 ? "l" : i > n - 3 ? "r" : ""}" style="left:${x(i)}%;bottom:${100 - y(v)}%">
			<div class="tip"><b>${esc(moment(t.months[i].month).format("MMM YYYY"))}</b><br>${money(v)}</div></div>`
		)
		.join("");
	return `<div class="chart-note">${__("Our savings now {0}", [`<b>${money(pts[n - 1])}</b>`])}</div>
		<div class="area">
			<svg viewBox="0 0 100 100" preserveAspectRatio="none">
				<defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16a34a" stop-opacity=".35"/>
					<stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></linearGradient></defs>
				<path d="${path} L 100 100 L 0 100 Z" fill="url(#gf)"/>
				<path d="${path}" fill="none" stroke="#16a34a" stroke-width="3" vector-effect="non-scaling-stroke"/>
			</svg>
			${dots}
		</div>
		<div class="xl">${t.months.map((m, i) => `<div style="left:${x(i)}%">${esc(moment(m.month).format("MMM"))}</div>`).join("")}</div>`;
}

function donut(mix) {
	const total = mix.reduce((a, m) => a + m.amount, 0);
	if (!total) return clear(__("No loans yet"), "🤝");
	let off = 0;
	const segs = mix
		.map((m) => {
			const pc = (m.amount / total) * 100;
			const s = `<circle cx="21" cy="21" r="15.915" stroke="${LOAN_C[m.status] || "#64748b"}"
				stroke-dasharray="${pc} ${100 - pc}" stroke-dashoffset="${-off}"/>`;
			off += pc;
			return s;
		})
		.join("");
	return `<div class="donut-wrap">
		<div class="donut"><svg viewBox="0 0 42 42">${segs}</svg>
			<div class="mid"><b>${short_money(total)}</b><span>${esc(__("all loans"))}</span></div></div>
		<div>${mix
			.map(
				(m) => `<div class="key" ${route_attr(["List", "Loan"], { status: m.status })}>
				<i style="background:${LOAN_C[m.status] || "#64748b"}"></i>
				<span><b>${esc(__(m.status))}</b> <span class="muted">· ${m.count}</span></span><b>${money(m.amount)}</b></div>`
			)
			.join("")}</div></div>`;
}

function charts(d, state) {
	const tabs = [
		["bars", "📊", __("Collection")],
		["growth", "📈", __("Savings growth")],
		["donut", "🍩", __("Loans")],
	];
	const body = state.chart === "growth" ? growth(d.trends) : state.chart === "donut" ? donut(d.loan_mix) : bars(d.trends, d.month);
	const tab_html = `<div class="tabs">${tabs
		.map(([k, ic, l]) => `<button class="tab ${state.chart === k ? "on" : ""}" data-chart="${k}">${ic} ${esc(l)}</button>`)
		.join("")}</div>`;
	return `<div class="box">${sec("📉", __("Trends"), tab_html)}${body}</div>`;
}

// ------------------------------------------------------------------ render

function draw(host, d, state) {
	const parts = [hero(d), quick(d)];
	if (d.me) parts.push(`<div class="three">${bill(d)}${khata(d)}${votes(d)}</div>`);
	if (d.admin) parts.push(`<div class="two">${action_center(d, state)}${roster(d)}</div>`);
	parts.push(wallet(d), charts(d, state));
	host.innerHTML = parts.join("");
}

function render(root) {
	if (!root.querySelector("style[data-gd]")) {
		const style = document.createElement("style");
		style.dataset.gd = "1";
		style.textContent = STYLE;
		root.appendChild(style);
	}
	let host = root.querySelector(".g");
	if (!host) {
		host = document.createElement("div");
		host.className = "g";
		root.appendChild(host);
	}
	if (host._load) return host._load();

	const state = { data: null, action: "verify", chart: "bars" };
	const load = () => {
		if (!state.data) host.innerHTML = `<div class="loading">${esc(__("Loading…"))}</div>`;
		frappe.call(METHOD).then((r) => {
			state.data = r.message;
			const a = state.data.admin;
			// open the Action Center on the first tab that has work
			if (a && !a.to_verify.length) state.action = a.decisions.length ? "decide" : a.unpaid.length ? "unpaid" : "verify";
			draw(host, state.data, state);
		});
	};
	host._load = load;

	host.addEventListener("click", (e) => {
		if (e.target.closest("[data-refresh]")) return load();
		const vote = e.target.closest("[data-vote]");
		if (vote) {
			vote.parentElement.querySelectorAll("button").forEach((b) => (b.disabled = true));
			frappe
				.xcall(VOTE, { loan: vote.dataset.loan, vote: vote.dataset.vote })
				.then(() => {
					frappe.show_alert({ message: __("Vote saved"), indicator: "green" });
					load();
				})
				.catch(load);
			return;
		}
		const action = e.target.closest("[data-action]");
		if (action) {
			state.action = action.dataset.action;
			return draw(host, state.data, state);
		}
		const chart = e.target.closest("[data-chart]");
		if (chart) {
			state.chart = chart.dataset.chart;
			return draw(host, state.data, state);
		}
		const link = e.target.closest("[data-route]");
		if (link) {
			const route = JSON.parse(link.dataset.route);
			if (route[0] === "Form" && route[2] === "new") return frappe.new_doc(route[1]);
			if (link.dataset.filters) frappe.route_options = JSON.parse(link.dataset.filters);
			frappe.set_route(...route);
		}
	});

	load();
}

window.gat.dashboard = { render };
