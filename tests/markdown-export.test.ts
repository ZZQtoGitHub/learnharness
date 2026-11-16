/**
 * THE SESSION MARKDOWN EXPORT ROUTE (owner, release polish 2026-10-06):
 * GET /api/chats/:id/markdown — the user-facing export. The engine
 * itself is pinned by tests/session-markdown.test.ts; this file pins
 * the ROUTE contract: 404 unknown chat, the attachment headers, the
 * slugified filename, the anchorless document with the title header.
 *
 * Runs under an isolated LH_DATA_DIR (the chat-birth-stamp discipline:
 * the seam is set before any config-loading import, so every
 * app-module import is dynamic).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, before, describe, it } from "node:test";

// ── the seam, BEFORE any config-loading import ──────────────────────────────
const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-md-export-"));
process.env.LH_DATA_DIR = TMP_DATA;

/** The route handler + the store seam, loaded AFTER the env is set. */
type Get = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let GET: Get;
let createChat: (title: string, kind?: "practice") => { id: string; title: string };
let saveMessages: (id: string, messages: unknown[]) => void;

before(async () => {
	const route = await import("../app/api/chats/[id]/markdown/route.ts");
	GET = route.GET;
	const server = await import("../src/server/chats.ts");
	createChat = server.createChat;
	const { chatStore } = await import("../src/store/chats.ts");
	saveMessages = (id, messages) => chatStore.saveMessages(id, messages as never);
});

describe("GET /api/chats/:id/markdown", () => {
	it("404s an unknown chat", async () => {
		const res = await GET(new Request("http://x/api/chats/nope/markdown"), { params: Promise.resolve({ id: "nope" }) });
		assert.equal(res.status, 404);
	});

	it("exports the session as an anchorless markdown attachment, filename from the title", async () => {
		const chat = createChat("Relational Databases — Joins & Normal Forms");
		saveMessages(chat.id, [
			{ id: "m1", role: "user", content: "Teach me joins" },
			{ id: "m2", role: "assistant", content: "A join combines rows." },
		]);
		const res = await GET(new Request("http://x/api"), { params: Promise.resolve({ id: chat.id }) });
		assert.equal(res.status, 200);
		assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8");
		const disposition = res.headers.get("content-disposition") ?? "";
		assert.ok(disposition.startsWith("attachment;"), "it is a download");
		assert.ok(disposition.includes('filename="relational-databases-joins-normal-forms.md"'), "slugified title names the file");
		const body = await res.text();
		assert.ok(body.startsWith("# Relational Databases"), "the title mints the document header");
		assert.ok(body.includes("### Learner"), "learner blocks render");
		assert.ok(body.includes("### Teacher"), "teacher blocks render");
		assert.ok(!body.includes("m1"), "anchorless — no message-id provenance in the user-facing export");
	});

	it("a title with no ASCII alphanumerics keeps its own name via filename*", async () => {
		const chat = createChat("日本語"); // nothing survives the ASCII slug…
		saveMessages(chat.id, [{ id: "m1", role: "user", content: "hello" }]);
		const res = await GET(new Request("http://x/api"), { params: Promise.resolve({ id: chat.id }) });
		assert.equal(res.status, 200);
		const disposition = res.headers.get("content-disposition") ?? "";
		assert.ok(disposition.includes('filename="session.md"'), "ASCII clients still get a safe name");
		// …but the real title rides the RFC 5987 form, so downloads are distinguishable.
		assert.ok(disposition.includes("filename*=UTF-8''%E6%97%A5%E6%9C%AC%E8%AA%9E.md"), "the UTF-8 name is the title");
	});

	it("a Chinese title downloads under its own name, not the fallback", async () => {
		const chat = createChat("关系数据库：连接与范式");
		saveMessages(chat.id, [{ id: "m1", role: "user", content: "讲讲连接" }]);
		const res = await GET(new Request("http://x/api"), { params: Promise.resolve({ id: chat.id }) });
		const disposition = res.headers.get("content-disposition") ?? "";
		assert.ok(disposition.includes(`filename*=UTF-8''${encodeURIComponent("关系数据库：连接与范式.md").replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`), "the title names the file");
		assert.ok(!disposition.includes('filename="session.md"') || disposition.includes("filename*=UTF-8''"), "the fallback alone is not the answer");
	});

	it("an empty session exports the bare header document", async () => {
		const chat = createChat("Quiet one");
		const res = await GET(new Request("http://x/api"), { params: Promise.resolve({ id: chat.id }) });
		assert.equal(res.status, 200);
		const body = await res.text();
		assert.equal(body, "# Quiet one");
	});
});

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});
