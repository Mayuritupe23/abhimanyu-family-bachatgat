// "Home" (bare /desk) shows Frappe's app grid; Gat users should land on the
// Gat workspace instead.
//
// This file is loaded in <head>, so the check below runs before frappe.start_app() paints the
// icon grid on a full page load.
if (window.location.pathname.replace(/\/+$/, "") === "/desk") {
	window.location.replace("/desk/gat");
}

// Clicking Home inside the app is a client-side route change to the empty route, which hits the
// same icon grid; send it to the workspace with a real navigation.
$(document).on("app_ready", function () {
	frappe.router.on("change", function () {
		const route = frappe.get_route() || [];
		if (!route[0]) {
			window.location.href = "/desk/gat";
		}
	});
});
