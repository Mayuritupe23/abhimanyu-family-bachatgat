import frappe
from frappe import _
from frappe.utils import add_days, add_years, flt, getdate

GAT_ROLES = ("Gat Member", "Gat Office Bearer", "Khajinadar")
MODULE_PROFILE = "Gat Member"
PRIVILEGED = {"System Manager", "Gat Office Bearer", "Khajinadar"}


def ensure_roles():
	for role in GAT_ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc(doctype="Role", role_name=role, desk_access=1).insert(ignore_permissions=True)

	# members see only this app in the desk
	profile = (
		frappe.get_doc("Module Profile", MODULE_PROFILE)
		if frappe.db.exists("Module Profile", MODULE_PROFILE)
		else frappe.new_doc("Module Profile", module_profile_name=MODULE_PROFILE)
	)
	profile.block_modules = []
	for module in frappe.get_all("Module Def", {"name": ["!=", "Nova Core"]}, pluck="name"):
		profile.append("block_modules", {"module": module})
	profile.save(ignore_permissions=True)

	# brand name on the login page and browser tab
	for doctype in ("Website Settings", "System Settings"):
		frappe.db.set_single_value(doctype, "app_name", "Abhimanyu Bachat Gat")
	frappe.db.set_single_value("System Settings", "allow_login_using_mobile_number", 1)


def get_settings():
	return frappe.get_cached_doc("Group Settings")


def sees_all(user=None):
	return bool(PRIVILEGED & set(frappe.get_roles(user)))


def current_member():
	member = frappe.db.get_value(
		"Member", {"user": frappe.session.user}, ["name", "designation", "status"], as_dict=True
	)
	if not member:
		frappe.throw(_("Your login is not linked to any Member"))
	return member


def check_own_member(member):
	"""Plain members may only create records for themselves."""
	if not sees_all() and current_member().name != member:
		frappe.throw(_("You can only create entries for yourself"), frappe.PermissionError)


def due_date(month, due_day):
	month = getdate(month)
	return month.replace(day=due_day)


def calc_fine(days_late, first_day_fine, per_day_fine):
	"""Day 1 late = first_day_fine, then +per_day_fine per extra day. No cap."""
	if days_late <= 0:
		return 0
	return flt(first_day_fine) + flt(per_day_fine) * (days_late - 1)


def completed_years(start, upto):
	"""(year_no, from, to) for each group year fully finished on or before `upto`."""
	start, upto = getdate(start), getdate(upto)
	k = 0
	while add_years(start, k + 1) <= upto:
		yield k + 1, add_years(start, k), add_days(add_years(start, k + 1), -1)
		k += 1


def earnings_share(member, start, upto):
	"""Member's share of each completed year's earnings, in ratio of savings that year."""
	rows = []
	for year, ys, ye in completed_years(start, upto):
		pays = frappe.get_all(
			"Monthly Payment",
			filters={"docstatus": 1, "month": ["between", [ys, ye]]},
			fields=["member", "saving", "interest", "fine"],
		)
		expense = flt(
			frappe.db.get_value("Group Expense", {"date": ["between", [ys, ye]]}, [{"SUM": "amount"}])
		)
		earnings = sum(flt(p.interest) + flt(p.fine) for p in pays) - expense
		total = sum(flt(p.saving) for p in pays)
		mine = sum(flt(p.saving) for p in pays if p.member == member)
		share = flt(earnings * mine / total, 2) if total else 0
		rows.append(frappe._dict(year=year, start=ys, end=ye, earnings=earnings, mine=mine, total=total, share=share))
	return rows


# Permissions: plain members see only their own Member / payments / exit.


def _own_member_sql(user):
	return frappe.db.escape(user or frappe.session.user)


def member_pqc(user):
	if sees_all(user):
		return ""
	return f"`tabMember`.`user` = {_own_member_sql(user)}"


def member_link_pqc(user, doctype):
	if sees_all(user):
		return ""
	return f"`tab{doctype}`.`member` in (select name from `tabMember` where `user` = {_own_member_sql(user)})"


def monthly_payment_pqc(user):
	return member_link_pqc(user, "Monthly Payment")


def member_exit_pqc(user):
	return member_link_pqc(user, "Member Exit")


def has_member_permission(doc, ptype=None, user=None):
	user = user or frappe.session.user
	if sees_all(user):
		return True
	if doc.doctype == "Member":
		return doc.user == user
	if not doc.get("member"):  # new doc, member not chosen yet
		return True
	return frappe.db.get_value("Member", doc.member, "user") == user


def has_loan_permission(doc, ptype=None, user=None):
	"""All members read every loan (needed to vote); only the applicant edits their draft."""
	if ptype not in ("write", "submit", "cancel", "delete", "amend"):
		return True
	return has_member_permission(doc, ptype, user)


def lock_workspace(doc, method=None):
	"""The Gat workspace ships with the app; nobody edits it on a live site."""
	if doc.name != "Gat" or frappe.conf.developer_mode:
		return
	if frappe.flags.in_install or frappe.flags.in_migrate or frappe.flags.in_import:
		return
	frappe.throw(_("The Gat workspace cannot be edited"))
