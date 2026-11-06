"""The Monthly Sheet as a designed Excel file (.xlsx): same look as the sheet image.

The browser already builds each sheet as a spec (title, columns, rows, total, note) for the
image; it sends the same specs here and gets back the .xlsx as base64. One spec = one tab.
"""

import base64
import json
from io import BytesIO

import frappe
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

GREEN, DARK, LIGHT, PALE, LINE = "15803D", "14532D", "DCFCE7", "F0FDF4", "BBF7D0"
# Indian grouping (1,21,500) in Excel and LibreOffice
INR = r"[>=10000000]##\,##\,##\,##0;[>=100000]##\,##\,##0;##,##0"
ALIGN = {"l": "left", "r": "right", "c": "center"}
TAB = {"FINANCIAL": "Statement"}


def fill(hex_):
	return PatternFill("solid", start_color=hex_, end_color=hex_)


def put(ws, row, col, value, **style):
	cell = ws.cell(row=row, column=col, value=value)
	if isinstance(value, str) and value[:1] in "=+-@":
		cell.data_type = "s"  # a name never runs as a formula
	for k, v in style.items():
		setattr(cell, k, v)
	return cell


def add_sheet(wb, spec):
	cols, rows = spec["cols"], spec["rows"]
	n = len(cols)
	title = TAB.get(spec["title"].split(" ")[0], "Paise Bharna")
	ws = wb.create_sheet(title if title not in wb.sheetnames else f"{title} 2")
	side = Side(style="thin", color=LINE)
	box = Border(left=side, right=side, top=side, bottom=side)
	last = get_column_letter(n)

	r = 1
	for text, font, height in (
		(spec["title"], Font(bold=True, size=16, color=DARK), 30),
		(spec.get("subtitle"), Font(bold=True, size=12, color="16A34A"), 20),
		("     ·     ".join(spec.get("meta") or []) or None, Font(bold=True, size=11, color="B45309"), 20),
	):
		if not text:
			continue
		ws.merge_cells(f"A{r}:{last}{r}")
		put(ws, r, 1, text, font=font, alignment=Alignment(horizontal="center", vertical="center"))
		ws.row_dimensions[r].height = height
		r += 1
	r += 1

	head = r
	for i, col in enumerate(cols, 1):
		put(ws, r, i, col[0], font=Font(bold=True, color="FFFFFF"), fill=fill(GREEN), border=box,
			alignment=Alignment(horizontal=ALIGN.get(col[1], "left"), vertical="center"))
		ws.column_dimensions[get_column_letter(i)].width = max(int(col[2]) / 7, 8)
	ws.row_dimensions[r].height = 24

	for k, values in enumerate(rows):
		r += 1
		for i, (col, v) in enumerate(zip(cols, values), 1):
			bg = (col[4] if len(col) > 4 and col[4] else None) or (PALE if k % 2 else "FFFFFF")
			color = (col[3] if len(col) > 3 and col[3] else "0F172A").lstrip("#")
			c = put(ws, r, i, v, fill=fill(bg.lstrip("#")), border=box,
				font=Font(bold=i == 2 or i == n, color=color),
				alignment=Alignment(horizontal=ALIGN.get(col[1], "left"), vertical="center"))
			if isinstance(v, (int, float)):
				c.number_format = INR
		ws.row_dimensions[r].height = 20

	r += 1
	for i, (col, v) in enumerate(zip(cols, spec["total"]), 1):
		c = put(ws, r, i, v, font=Font(bold=True, color=DARK), fill=fill(LIGHT), border=box,
			alignment=Alignment(horizontal=ALIGN.get(col[1], "left"), vertical="center"))
		if isinstance(v, (int, float)):
			c.number_format = INR
	ws.row_dimensions[r].height = 22

	r += 2
	ws.merge_cells(f"A{r}:{last}{r}")
	put(ws, r, 1, spec.get("note"), font=Font(italic=True, color="64748B"), alignment=Alignment(wrap_text=True, vertical="top"))
	ws.row_dimensions[r].height = 15 * (1 + len(spec.get("note") or "") // 110)
	put(ws, r + 1, 1, "Abhimanyu Family Bachat Gat", font=Font(bold=True, color=GREEN))
	ws.freeze_panes = ws.cell(row=head + 1, column=3)
	ws.sheet_view.showGridLines = False
	ws.page_setup.orientation = "landscape"
	ws.page_setup.fitToWidth = 1
	ws.sheet_properties.pageSetUpPr.fitToPage = True


@frappe.whitelist()
def sheet_xlsx(specs):
	specs = json.loads(specs) if isinstance(specs, str) else specs
	if not isinstance(specs, list) or not 0 < len(specs) <= 4 or any(len(s.get("rows", [])) > 500 for s in specs):
		frappe.throw("Invalid sheet")
	wb = Workbook()
	wb.remove(wb.active)
	for spec in specs:
		add_sheet(wb, spec)
	out = BytesIO()
	wb.save(out)
	return base64.b64encode(out.getvalue()).decode()
