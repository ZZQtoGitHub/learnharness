/**
 * THE SESSION MARKDOWN EXPORT (owner, release polish 2026-10-06): the
 * user-facing export the session-markdown engine was built for — the
 * same document the extractor reads, minted anchorless (anchors are
 * extraction provenance; a learner's export carries no message ids).
 *
 * GET /api/chats/:id/markdown → the whole session as one markdown file
 * (Content-Disposition attachment; filename from the slugified title).
 * 404 unknown chat. Both session kinds export — practice sessions ride
 * the same engine (problem/conclude results render as tool blocks,
 * markers are invisible by the engine's law).
 */
import { sessionMarkdown } from "@/src/core";
import { getChat } from "@/src/server";

/** Filename-safe title (own module scope on purpose: tiny + pure). */
function slugify(title: string): string {
	const slug = title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug.length > 0 ? slug : "session";
}

/** The name a person should see in their downloads folder: the title itself,
 *  stripped of the characters a filesystem refuses, capped by CODE POINTS so
 *  a Chinese title is not cut mid-surrogate. */
function downloadStem(title: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return Array.from(cleaned).slice(0, 60).join("") || "session";
}

/** RFC 6266 filename*: the UTF-8 form carries the real title (简体中文 included);
 *  the bare `filename=` stays an ASCII fallback for clients that ignore it.
 *  encodeURIComponent leaves ' ( ) * unescaped, but they are not attr-chars. */
function utf8Filename(title: string): string {
	return encodeURIComponent(`${downloadStem(title)}.md`)
		.replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const { id } = await ctx.params;
	const record = getChat(id);
	if (!record) return Response.json({ error: "会话不存在" }, { status: 404 });
	const markdown = sessionMarkdown(record.messages, { title: record.title, anchors: false });
	return new Response(markdown, {
		headers: {
			"content-type": "text/markdown; charset=utf-8",
			"content-disposition": `attachment; filename="${slugify(record.title)}.md"; filename*=UTF-8''${utf8Filename(record.title)}`,
		},
	});
}
