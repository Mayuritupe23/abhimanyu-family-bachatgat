# Copyright (c) 2026, Zuneko and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils.password import update_password

from nova_core.gat import GAT_ROLES, MODULE_PROFILE


class Member(Document):
	def on_update(self):
		if not self.user:
			return
		wanted = {"Gat Member"}
		if self.designation != "Member":
			wanted.add("Gat Office Bearer")
		if self.designation == "Khajinadar" or self.get("can_enter_data"):
			wanted.add("Khajinadar")
		user = frappe.get_doc("User", self.user)
		user.flags.ignore_permissions = True
		user.remove_roles(*[r for r in GAT_ROLES if r not in wanted])
		user.add_roles(*wanted)

		user.reload()
		user.update({"default_app": "nova_core", "default_workspace": "Gat"})
		if "System Manager" not in frappe.get_roles(user.name):
			user.module_profile = MODULE_PROFILE
		user.save(ignore_permissions=True)


@frappe.whitelist()
def create_login(member, password):
	"""Make a login for a member: mobile number (or email) + password."""
	frappe.only_for(("Khajinadar", "System Manager"))
	doc = frappe.get_doc("Member", member)
	if doc.user:
		frappe.throw(_("{0} already has a login").format(doc.member_name))
	if not doc.mobile:
		frappe.throw(_("Add a mobile number first"))
	user = frappe.get_doc(
		doctype="User",
		email=f"{doc.mobile}@gat.local",
		mobile_no=doc.mobile,
		first_name=doc.member_name,
		send_welcome_email=0,
		user_type="System User",
	).insert(ignore_permissions=True)
	update_password(user.name, password)
	doc.user = user.name
	doc.save(ignore_permissions=True)
	return user.name
