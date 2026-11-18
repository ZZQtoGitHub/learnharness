/**
 * ui-snapshot.mjs — boot the packaged standalone server exactly the way the
 * Electron shell does (mirroring smoke-server.mjs) and capture zh-CN UI
 * screenshots with headless Chromium via Playwright.
 *
 * Environment is fully throwaway: a temp LH_DATA_DIR, an empty LH_AUTH_FILE,
 * production NODE_ENV, 127.0.0.1 on a kernel-assigned free port. No real
 * keys, no real learner data. The child is ALWAYS killed before exit.
 *
 * Screenshots land in ./ui-snapshots/*.png (full-page, 1440x900@2x) and are
 * uploaded as a workflow artifact. A step that throws still captures a
 * "-FAILED" frame so reviewers can see what state the UI was in.
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
const serverJs = path.join(standalone, "server.js");

if (!fs.existsSync(serverJs)) {
	console.error("[ui-snapshot] .next/standalone/server.js missing — run scripts/build-server.mjs first.");
	process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/** A free TCP port (listen(0) → the kernel assigns one) — mirrors main.cjs. */
const freePort = () =>
	new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.listen(0, "127.0.0.1", () => {
			const port = srv.address().port;
			srv.close(() => resolve(port));
		});
		srv.on("error", reject);
	});

const port = await freePort();
const home = fs.mkdtempSync(path.join(os.tmpdir(), "lh-ui-shot-"));
fs.mkdirSync(path.join(home, "data"), { recursive: true });
fs.writeFileSync(path.join(home, "auth.json"), "");

const child = spawn(process.execPath, [serverJs], {
	cwd: standalone,
	env: { ...probeEnv(process.env, home), PORT: String(port), HOSTNAME: "127.0.0.1" },
	stdio: ["ignore", "pipe", "pipe"],
});
const tail = [];
const keep = (buf) => tail.push(...buf.toString().split("\n").filter((l) => l.trim()).slice(-4));
child.stdout.on("data", keep);
child.stderr.on("data", keep);
child.on("exit", (code) => {
	if (code !== null && code !== 0 && !finished) {
		console.error(`[ui-snapshot] server exited early (code ${code})`);
		console.error(tail.join("\n"));
		process.exit(1);
	}
});

let finished = false;

/** Poll GET / until 200 (30s boot timeout), mirroring smoke-server.mjs. */
const waitReady = async () => {
	for (let i = 0; i < 60; i++) {
		if (child.exitCode !== null) {
			console.error("[ui-snapshot] server died during boot");
			console.error(tail.join("\n"));
			process.exit(1);
		}
		const ok = await new Promise((resolve) => {
			const req = http.get({ host: "127.0.0.1", port, path: "/" }, (res) => {
				res.resume();
				resolve(res.statusCode === 200);
			});
			req.on("error", () => resolve(false));
		});
		if (ok) return;
		await new Promise((r) => setTimeout(r, 500));
	}
	console.error("[ui-snapshot] server did not become ready within 30s");
	console.error(tail.join("\n"));
	process.exit(1);
};
await waitReady();
console.log(`[ui-snapshot] server ready on 127.0.0.1:${port}`);

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 2,
	locale: "zh-CN",
});
const page = await context.newPage();

const shot = async (name, fn) => {
	try {
		if (fn) await fn();
		await page.waitForLoadState("networkidle").catch(() => {});
		await page.waitForTimeout(800);
		await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
		console.log(`[ui-snapshot] captured ${name}`);
	} catch (err) {
		console.error(`[ui-snapshot] FAILED ${name}: ${String(err.message).split("\n")[0]}`);
		await page.screenshot({ path: path.join(OUT, `${name}-FAILED.png`), fullPage: true }).catch(() => {});
	}
};

const base = `http://127.0.0.1:${port}`;

await shot("01-home", () => page.goto(`${base}/`, { waitUntil: "domcontentloaded" }));
await shot("02-chat-new", () => page.goto(`${base}/chat/new`, { waitUntil: "domcontentloaded" }));
await shot("03-settings-first", () => page.goto(`${base}/settings`, { waitUntil: "domcontentloaded" }));
await shot("04-settings-plugins", () => page.click('[data-testid="settings-nav-plugins"]'));
await shot("05-settings-agent", () =>
	page.click('[data-testid="settings-nav-agent"]').catch(() => page.click('text=/模型|智能体|教学/')),
);

await browser.close();
child.kill("SIGTERM");
finished = true;
console.log(`[ui-snapshot] done → ${OUT}`);
process.exit(0);
