"""Installable app (PWA): web manifest and service worker.

Frappe serves no .js/.json from www, so both come from API endpoints. The worker sends
`Service-Worker-Allowed: /` so it can control the whole site, not just /api/.
"""

import json

import frappe
from werkzeug.wrappers import Response

VERSION = "gat-v1"  # bump to drop old caches on every phone
IMG = "/assets/nova_core/images"


@frappe.whitelist(allow_guest=True)
def manifest():
	data = {
		"id": "/desk/gat",
		"name": "Abhimanyu Bachat Gat",
		"short_name": "Bachat Gat",
		"description": "Family savings group: monthly hapta, loans, votes and reports",
		"start_url": "/desk/gat?source=pwa",
		"scope": "/",
		"display": "standalone",
		"orientation": "portrait",
		"background_color": "#f5faf6",
		"theme_color": "#15803d",
		"lang": "mr",
		"categories": ["finance", "productivity"],
		"icons": [
			{"src": f"{IMG}/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
			{"src": f"{IMG}/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
			{"src": f"{IMG}/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
		],
		"shortcuts": [
			{"name": "Pay now", "short_name": "Pay", "url": "/desk/monthly-payment/new",
				"icons": [{"src": f"{IMG}/icon-192.png", "sizes": "192x192"}]},
			{"name": "Monthly Sheet", "short_name": "Sheet", "url": "/desk/gat-monthly",
				"icons": [{"src": f"{IMG}/icon-192.png", "sizes": "192x192"}]},
			{"name": "My Passbook", "short_name": "Passbook", "url": "/desk/query-report/Member Passbook",
				"icons": [{"src": f"{IMG}/icon-192.png", "sizes": "192x192"}]},
		],
	}
	return Response(json.dumps(data), mimetype="application/manifest+json", headers={"Cache-Control": "public, max-age=3600"})


SERVICE_WORKER = """
const CACHE = "%(version)s";
const OFFLINE = "/assets/nova_core/offline.html";
const PRECACHE = [OFFLINE, "%(img)s/emblem.svg", "%(img)s/logo.svg", "%(img)s/icon-192.png"];

self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
	e.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (e) => {
	const req = e.request;
	const url = new URL(req.url);
	if (req.method !== "GET" || url.origin !== location.origin) return;

	// pages: always fresh from the server (money data), offline page when there is no network
	if (req.mode === "navigate") {
		e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
		return;
	}
	// built assets: serve from cache, refresh in the background
	if (url.pathname.startsWith("/assets/")) {
		e.respondWith(
			caches.open(CACHE).then((c) =>
				c.match(req).then((hit) => {
					const fresh = fetch(req).then((res) => {
						if (res.ok) c.put(req, res.clone());
						return res;
					});
					return hit || fresh;
				})
			)
		);
	}
	// everything else (API calls, files) goes straight to the network
});
"""


@frappe.whitelist(allow_guest=True)
def service_worker():
	return Response(
		SERVICE_WORKER % {"version": VERSION, "img": IMG},
		mimetype="application/javascript",
		headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
	)
