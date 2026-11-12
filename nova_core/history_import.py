"""Move the group's history between sites as plain CSV files.

	bench --site old.site execute nova_core.history_import.export --kwargs "{'folder': '/path/to/folder'}"
	bench --site new.site execute nova_core.history_import.run --kwargs "{'folder': '/path/to/folder'}"

`run` expects a site with no payments or loans yet. It creates missing members, then loans and
payments exactly as written in the files (amounts are not recalculated), and commits only when
the totals in the database equal the totals in the files.
"""

import csv
from pathlib import Path

import frappe
from frappe.utils import cint, flt

FILES = ("settings", "members", "loans", "payments", "payment_loans", "expenses")
SETTINGS = (
	"group_name", "group_start_date", "monthly_saving", "due_day", "late_fine_first_day", "late_fine_per_day",
	"interest_rate", "loan_limit", "loan_tenure_months", "opening_cash", "opening_earnings", "payee_name", "upi_id",
)


def _write(path, header, rows):
	with open(path, "w", newline="", encoding="utf-8") as f:
		w = csv.writer(f)
		w.writerow(header)
		w.writerows(rows)


def _read(folder, name):
	with open(Path(folder) / f"{name}.csv", encoding="utf-8") as f:
		return list(csv.DictReader(f))


def export(folder):
	folder = Path(folder)
	folder.mkdir(parents=True, exist_ok=True)
	s = frappe.get_doc("Group Settings")
	_write(folder / "settings.csv", ["Setting", "Value"], [[k, s.get(k) or ""] for k in SETTINGS])

	members = frappe.get_all(
		"Member", fields=["name", "member_name", "designation", "join_date", "mobile", "can_enter_data", "opening_savings", "status"],
		order_by="name",
	)
	_write(folder / "members.csv",
		["Member ID", "Member Name", "Designation", "Join Date", "Mobile", "Can Approve Payments", "Opening Savings", "Status"],
		[[m.name, m.member_name, m.designation, m.join_date, m.mobile, m.can_enter_data, flt(m.opening_savings), m.status] for m in members])

	loans = frappe.get_all(
		"Loan", filters={"docstatus": 1},
		fields=["name", "member", "member_name", "amount", "disbursed_on", "is_opening", "outstanding", "status", "purpose", "due_date"],
		order_by="disbursed_on, name",
	)
	_write(folder / "loans.csv",
		["Loan ID", "Member ID", "Member Name", "Amount", "Given On", "Not From Group Cash", "Balance Now", "Status", "Note", "Close By"],
		[[l.name, l.member, l.member_name, flt(l.amount), l.disbursed_on, l.is_opening, flt(l.outstanding), l.status, l.purpose, l.due_date or ""] for l in loans])

	pays = frappe.get_all(
		"Monthly Payment", filters={"docstatus": 1},
		fields=["name", "month", "member", "member_name", "payment_date", "payment_mode", "saving", "interest", "principal", "fine", "total"],
		order_by="month, member",
	)
	_write(folder / "payments.csv",
		["Payment ID", "Month", "Member ID", "Member Name", "Paid On", "Paid By", "Shares", "Interest", "EMI", "Penalty", "Total"],
		[[p.name, p.month, p.member, p.member_name, p.payment_date, p.payment_mode, flt(p.saving), flt(p.interest),
			flt(p.principal), flt(p.fine), flt(p.total)] for p in pays])

	rows = frappe.get_all(
		"Monthly Payment Loan", filters={"parent": ["in", [p.name for p in pays] or [""]]},
		fields=["parent", "loan", "outstanding", "interest", "principal"], order_by="parent, idx",
	)
	_write(folder / "payment_loans.csv", ["Payment ID", "Loan ID", "Loan At Start", "Interest", "EMI"],
		[[r.parent, r.loan, flt(r.outstanding), flt(r.interest), flt(r.principal)] for r in rows])

	exp = frappe.get_all("Group Expense", fields=["date", "amount", "description"], order_by="date")
	_write(folder / "expenses.csv", ["Date", "Amount", "Description"], [[e.date, flt(e.amount), e.description] for e in exp])
	print(f"exported to {folder}: {len(members)} members, {len(loans)} loans, {len(pays)} payments")


def run(folder):
	if frappe.db.count("Monthly Payment") or frappe.db.count("Loan"):
		frappe.throw("This site already has payments or loans. Import only into a fresh site.")
	data = {name: _read(folder, name) for name in FILES}

	s = frappe.get_doc("Group Settings")
	for r in data["settings"]:
		if r["Value"] != "":
			ftype = s.meta.get_field(r["Setting"]).fieldtype
			value = cint(r["Value"]) if ftype == "Int" else flt(r["Value"]) if ftype in ("Currency", "Percent") else r["Value"]
			s.set(r["Setting"], value)
	s.save()

	member = {}  # file member id -> site member id
	for r in data["members"]:
		name = frappe.db.get_value("Member", {"member_name": r["Member Name"]}) or frappe.db.get_value("Member", {"mobile": r["Mobile"]})
		doc = frappe.get_doc("Member", name) if name else frappe.new_doc("Member")
		doc.update({
			"member_name": r["Member Name"], "designation": r["Designation"], "join_date": r["Join Date"],
			"mobile": r["Mobile"], "can_enter_data": int(r["Can Approve Payments"] or 0),
			"opening_savings": flt(r["Opening Savings"]), "status": r["Status"] or "Active",
		})
		doc.save() if name else doc.insert()
		member[r["Member ID"]] = doc.name

	loan, balance = {}, {}
	for r in data["loans"]:
		doc = frappe.get_doc(dict(
			doctype="Loan", member=member[r["Member ID"]], member_name=r["Member Name"], amount=flt(r["Amount"]),
			purpose=r["Note"], is_opening=int(r["Not From Group Cash"] or 0),
			opening_date=r["Given On"] if int(r["Not From Group Cash"] or 0) else None,
			# loans from before the app have no close date; ones from Nov 2026 on follow the 10-month rule
			status="Active", application_date=r["Given On"], disbursed_on=r["Given On"], due_date=r.get("Close By") or None,
			outstanding=flt(r["Amount"]), docstatus=1,
		))
		doc.set_new_name()
		doc.db_insert()
		loan[r["Loan ID"]] = doc.name
		balance[doc.name] = (flt(r["Balance Now"]), r["Status"])

	children = {}
	for r in data["payment_loans"]:
		children.setdefault(r["Payment ID"], []).append(
			{"loan": loan[r["Loan ID"]], "outstanding": flt(r["Loan At Start"]), "interest": flt(r["Interest"]), "principal": flt(r["EMI"])}
		)
	for r in data["payments"]:
		doc = frappe.get_doc(dict(
			doctype="Monthly Payment", member=member[r["Member ID"]], member_name=r["Member Name"], month=r["Month"],
			payment_date=r["Paid On"], payment_mode=r["Paid By"] or "UPI", utr="Imported",
			saving=flt(r["Shares"]), interest=flt(r["Interest"]), principal=flt(r["EMI"]), fine=flt(r["Penalty"]),
			total=flt(r["Total"]), days_late=0, docstatus=1, loans=children.get(r["Payment ID"], []),
		))
		doc.set_new_name()
		doc.set_parent_in_children()
		doc.db_insert()
		for child in doc.loans:
			child.docstatus = 1
			child.db_insert()

	for name, (bal, status) in balance.items():
		frappe.db.set_value("Loan", name, {"outstanding": bal, "status": status}, update_modified=False)
	for r in data["expenses"]:
		frappe.get_doc(dict(doctype="Group Expense", date=r["Date"], amount=flt(r["Amount"]), description=r["Description"])).insert()

	# the database must hold exactly what the files say
	def file_sum(rows, col):
		return round(sum(flt(r[col]) for r in rows), 2)

	def db_sum(doctype, field):
		return round(flt(frappe.db.get_value(doctype, {"docstatus": 1}, [{"SUM": field}])), 2)

	checks = [
		("shares", file_sum(data["payments"], "Shares"), db_sum("Monthly Payment", "saving")),
		("interest", file_sum(data["payments"], "Interest"), db_sum("Monthly Payment", "interest")),
		("EMI", file_sum(data["payments"], "EMI"), db_sum("Monthly Payment", "principal")),
		("penalty", file_sum(data["payments"], "Penalty"), db_sum("Monthly Payment", "fine")),
		("loans given", file_sum(data["loans"], "Amount"), db_sum("Loan", "amount")),
		("loan balance", file_sum(data["loans"], "Balance Now"), db_sum("Loan", "outstanding")),
		("payments", len(data["payments"]), frappe.db.count("Monthly Payment")),
	]
	bad = [c for c in checks if c[1] != c[2]]
	for c in checks:
		print(f"{c[0]:14} file {c[1]:>12,}  site {c[2]:>12,}  {'OK' if c[1] == c[2] else 'MISMATCH'}")
	if bad:
		frappe.db.rollback()
		frappe.throw("Totals do not match, nothing was imported.")
	frappe.db.commit()
	print("imported")
