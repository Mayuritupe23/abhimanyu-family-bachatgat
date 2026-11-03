// Makes the site installable as a phone app: manifest + icons in <head>, the service worker,
// and a friendly "Install" banner (Android/desktop prompt, or Add to Home Screen steps on iPhone).
(function () {
	const IMG = "/assets/nova_core/images";
	const t = (s) => (window.__ ? window.__(s) : s);
	const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
	if (standalone) document.documentElement.classList.add("gat-standalone");

	// head tags
	const add = (tag, attrs) => {
		const el = document.createElement(tag);
		Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
		document.head.appendChild(el);
	};
	if (!document.querySelector('link[rel="manifest"]')) {
		add("link", { rel: "manifest", href: "/api/method/nova_core.pwa.manifest" });
		add("link", { rel: "apple-touch-icon", href: `${IMG}/apple-touch-icon.png` });
		add("meta", { name: "apple-mobile-web-app-title", content: "Bachat Gat" });
	}
	document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", "#15803d"));
	if (!document.querySelector('meta[name="theme-color"]')) add("meta", { name: "theme-color", content: "#15803d" });

	if ("serviceWorker" in navigator) {
		window.addEventListener("load", () =>
			navigator.serviceWorker.register("/api/method/nova_core.pwa.service_worker", { scope: "/" }).catch(() => {})
		);
	}

	// install banner, at most once a week until installed
	const KEY = "gat-install-later";
	const snoozed = () => {
		try {
			return Date.now() - (+localStorage.getItem(KEY) || 0) < 7 * 864e5;
		} catch (e) {
			return false;
		}
	};
	const snooze = () => {
		try {
			localStorage.setItem(KEY, Date.now());
		} catch (e) {}
	};
	if (standalone || snoozed()) return;

	let prompt_event = null;
	const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

	function banner(body, action) {
		if (document.getElementById("gat-install")) return;
		const el = document.createElement("div");
		el.id = "gat-install";
		el.innerHTML = `
			<img src="${IMG}/icon-192.png" alt="">
			<div class="txt"><b>${t("Install Bachat Gat app")}</b><span>${body}</span></div>
			${action ? `<button class="go">${t("Install")}</button>` : ""}
			<button class="later" aria-label="${t("Later")}">✕</button>`;
		document.body.appendChild(el);
		requestAnimationFrame(() => el.classList.add("show"));
		el.querySelector(".later").onclick = () => {
			snooze();
			el.remove();
		};
		if (action) el.querySelector(".go").onclick = action;
	}

	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		prompt_event = e;
		setTimeout(
			() =>
				banner(t("Opens in one tap from your home screen, like any other app."), async () => {
					prompt_event.prompt();
					const { outcome } = await prompt_event.userChoice;
					if (outcome !== "accepted") snooze();
					document.getElementById("gat-install")?.remove();
				}),
			2500
		);
	});
	window.addEventListener("appinstalled", () => document.getElementById("gat-install")?.remove());

	if (ios) {
		window.addEventListener("load", () =>
			setTimeout(() => banner(t("Tap Share ⬆️ then 'Add to Home Screen'."), null), 2500)
		);
	}

	const style = document.createElement("style");
	style.textContent = `
		#gat-install { position: fixed; z-index: 1100; left: 12px; right: 12px; bottom: 14px; max-width: 460px; margin: 0 auto;
			display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 14px; border-radius: 18px; color: #fff;
			background: radial-gradient(circle at 95% 0%, rgba(245,158,11,.5), transparent 45%), linear-gradient(120deg, #16a34a, #14532d);
			box-shadow: 0 14px 34px rgba(20,83,45,.35); transform: translateY(140%); transition: transform .35s ease;
			font-family: inherit; }
		#gat-install.show { transform: none; }
		#gat-install img { width: 44px; height: 44px; border-radius: 12px; flex: none; }
		#gat-install .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 12.5px; line-height: 1.35; }
		#gat-install .txt b { font-size: 14.5px; }
		#gat-install .txt span { opacity: .9; }
		#gat-install button { border: 0; cursor: pointer; font: inherit; }
		#gat-install .go { background: #fbbf24; color: #451a03; font-weight: 800; border-radius: 12px; padding: 8px 14px; }
		#gat-install .later { background: rgba(255,255,255,.18); color: #fff; width: 30px; height: 30px; border-radius: 50%; flex: none; }
		/* installed app: keep content clear of the phone's notch and home bar */
		html.gat-standalone body { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }`;
	document.head.appendChild(style);
})();
