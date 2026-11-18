/**
 * ui-snapshot.mjs — boot the packaged standalone server exactly the way the
 * Electron shell does (mirroring smoke-server.mjs) and capture zh-CN UI
 * screenshots with headless Chromium via Playwright.
 *
 * Environment is fully throwaway: a temp LH_DATA_DIR, an empty LH_AUTH_FILE,
 * production NODE_ENV, 127.0.0.1 on a kernel-assigned free port. No real
 * keys, no real learner data. The child is ALWAYS killed before exit.
 *
 * v2: settings open via the sidebar entry (data-testid="settings-entry") —
 * /settings is a dialog host, not a standalone route, so direct navigation
 * lands on the new-session page (learned in run #1). Each dialog section is
 * captured by clicking its settings-nav-* entry.
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { chromium } from "playwright";
import { probeEnv } from "./smoke-demo-runtime.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "ui-snapshots");
const standalone = path.join(ROOT, ".next", "standalone");
const server = path.join(standalone, "server.js");

if (!fs.existsSync(server)) {
	console.error("[ui-snapshot] .next/standalone/server.js missing — run build-server.mjs first.");
	process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** A free TCP port (listen(0) → the kernel assigns one) — mirrors main.cjs. */
const freePort = () => new Promise((resolve, reject) => {
	const srv = net.createServer();
	srv.listen(0, "127.0.0.1", () => { const p = srv.address().port; srv.close(() => resolve(p)); });
	srv.on("error", reject);
});

const port = await freePort();
const home = fs.mkdtempSync(path.join(os.tmpdir(), "lh-ui-shot-"));
fs.mkdirSync(path.join(home, "data"), { recursive: true });
fs.writeFileSync(path.join(home, "auth.json"), "");

const child = spawn(process.execPath, [server], {
	cwd: standalone,
	env: { ...probeEnv(process.env, home), PORT: String(port), HOSTNAME: "127.0.0.1" },
	stdio: ["ignore", "pipe", "pipe"],
});
const tail = [];
child.stdout.on("data", (b) => tail.push(String(b)));
child.stderr.on("data", (b) => tail.push(String(b)));

const waitReady = async () => {
	for (let i = 0; i < 90; i++) {
		if (child.exitCode !== null) {
			console.error("[ui-snapshot] server exited early; log tail:");
			console.error(tail.slice(-40).join(""));
			process.exit(1);
		}
		const ok = await new Promise((resolve) => {
			const req = http.get({ host: "127.0.0.1", port, path: "/" }, (res) => { res.resume(); resolve(res.statusCode === 200); });
			req.on("error", () => resolve(false));
		});
		if (ok) return;
		await new Promise((r) => setTimeout(r, 500));
	}
	console.error("[ui-snapshot] server did not become ready; log tail:");
	console.error(tail.slice(-40).join(""));
	process.exit(1);
};
await waitReady();
console.log(`[ui-snapshot] server ready on 127.0.0.1:${port}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const shot = async (name, fn) => {
	try {
		if (fn) await fn();
		await page.waitForLoadState("networkidle").catch(() => {});
		await page.waitForTimeout(700);
		await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
		console.log(`[ui-snapshot] captured ${name}`);
	} catch (err) {
		console.error(`[ui-snapshot] FAILED ${name}: ${String(err.message).split("\n")[0]}`);
		await page.screenshot({ path: path.join(OUT, `${name}-FAILED.png`), fullPage: true }).catch(() => {});
	}
};

const base = `http://127.0.0.1:${port}`;
const nav = (id) => page.click(`[data-testid="settings-nav-${id}"]`);

await shot("01-home", () => page.goto(`${base}/`, { waitUntil: "domcontentloaded" }));
await shot("02-chat-new", () => page.goto(`${base}/chat/new`, { waitUntil: "domcontentloaded" }));
await shot("03-settings-keys", () => page.click('[data-testid="settings-entry"]'));
await shot("04-settings-agent", () => nav("agent"));
await shot("05-settings-appearance", () => nav("appearance"));
await shot("06-settings-graph", () => nav("graph"));
await shot("07-settings-general", () => nav("general"));
await shot("08-settings-core-plugins", () => nav("core-plugins"));
await shot("09-settings-community-plugins", () => nav("plugins"));

await browser.close();
child.kill("SIGTERM");
console.log(`[ui-snapshot] done → ${OUT}`);
process.exit(0);
