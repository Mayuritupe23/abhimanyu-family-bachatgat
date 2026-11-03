import frappe

no_cache = 1


def get_context(context):
	# the app posts with this token; Login reloads the page to get a fresh one
	context.csrf_token = frappe.sessions.get_csrf_token()
	context.no_cache = 1
