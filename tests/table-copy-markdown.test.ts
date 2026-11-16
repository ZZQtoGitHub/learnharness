/**
 * Copy-table / copy-diagram-source tests (issue #739): the corner copy must
 * hand back usable Markdown, not the rendered text.
 *
 * The old path borrowed streamdown's `extractTableDataFromElement`, which read
 * each cell with `cell.textContent.trim()` — `<code>`, `<strong>`, `<em>` and
 * links were flattened before `tableDataToMarkdown` ever saw them, so the paste
 * lost the author's formatting. `tableToMarkdown` reads the real DOM instead.
 * The mermaid copy had the mirror-image problem: it returned the bare chart
 * source, which pastes as plain text outside a fence.
 *
 * Idiom shared with render-md-blocks.test.tsx: `linkedom` gives a real DOM
 * without a browser, so the serializer is exercised against the same markup the
 * components produce.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { InteractionLayersProvider } from "../components/interaction-layers.tsx";
import { MessageResponse } from "../components/ai-elements/message.tsx";
import { fencedMermaid, tableToMarkdown } from "../lib/markdown-copy.ts";

function tableFrom(inner: string): HTMLTableElement {
	const { document } = parseHTML(`<html><body>${inner}</body></html>`);
	const table = document.querySelector("table");
	assert.ok(table, "the fixture carries a table");
	return table as unknown as HTMLTableElement;
}

describe("md-blocks — copy table as Markdown", () => {
	it("keeps inline code, bold and italic in the cells (the issue's own example)", () => {
		const table = tableFrom(`
			<table>
				<thead>
					<tr><th>Expression</th><th>New objects</th><th>Shared with the original</th></tr>
				</thead>
				<tbody>
					<tr>
						<td><code data-streamdown="inline-code">a.copy()</code>, <code data-streamdown="inline-code">a[:]</code>, <code data-streamdown="inline-code">list(a)</code></td>
						<td>the <strong data-streamdown="strong">outer list</strong></td>
						<td><em>every</em> element</td>
					</tr>
				</tbody>
			</table>`);
		assert.equal(
			tableToMarkdown(table),
			[
				"| Expression | New objects | Shared with the original |",
				"| --- | --- | --- |",
				"| `a.copy()`, `a[:]`, `list(a)` | the **outer list** | *every* element |",
			].join("\n"),
		);
	});

	it("keeps links, strikethrough and column alignment", () => {
		const table = tableFrom(`
			<table>
				<tr>
					<th>Name</th>
					<th align="center">Kind</th>
					<th style="text-align: right">Weight</th>
				</tr>
				<tr>
					<td><a href="https://example.com/a?b=1">docs</a></td>
					<td align="center"><s>old</s></td>
					<td align="right">3</td>
				</tr>
			</table>`);
		assert.equal(
			tableToMarkdown(table),
			[
				"| Name | Kind | Weight |",
				"| --- | :---: | ---: |",
				"| [docs](https://example.com/a?b=1) | ~~old~~ | 3 |",
			].join("\n"),
		);
	});

	it("escapes a pipe inside a cell instead of splitting the row", () => {
		const table = tableFrom(`
			<table>
				<tr><th>Op</th><th>Meaning</th></tr>
				<tr><td><code>a | b</code></td><td>either</td></tr>
			</table>`);
		assert.equal(
			tableToMarkdown(table),
			["| Op | Meaning |", "| --- | --- |", "| `a \\| b` | either |"].join("\n"),
		);
	});

	it("keeps a line break as <br>, and an empty row stays aligned", () => {
		const table = tableFrom(`
			<table>
				<tr><th>Term</th><th>Note</th></tr>
				<tr><td>first<br>second</td><td>A</td></tr>
				<tr><td>only one cell</td></tr>
			</table>`);
		assert.equal(
			tableToMarkdown(table),
			[
				"| Term | Note |",
				"| --- | --- |",
				"| first<br>second | A |",
				"| only one cell |  |",
			].join("\n"),
		);
	});

	it("widens the code fence when the cell itself contains backticks", () => {
		const table = tableFrom(`
			<table>
				<tr><th>Literal</th></tr>
				<tr><td><code>a \`inline\` b</code></td></tr>
			</table>`);
		assert.equal(
			tableToMarkdown(table),
			["| Literal |", "| --- |", "| ``a `inline` b`` |"].join("\n"),
		);
	});

	it("returns an empty string for a table with no rows", () => {
		assert.equal(tableToMarkdown(tableFrom("<table></table>")), "");
	});
});

describe("md-blocks — copy diagram source", () => {
	it("wraps the chart in its mermaid fence so a paste renders", () => {
		assert.equal(
			fencedMermaid("graph LR\n  grid((grid)) --> G[\"outer list A\"]\n"),
			"```mermaid\ngraph LR\n  grid((grid)) --> G[\"outer list A\"]\n```",
		);
	});

	it("grows the fence when the chart contains a backtick run", () => {
		assert.equal(fencedMermaid("graph LR\n  A --> B\n"), "```mermaid\ngraph LR\n  A --> B\n```");
		const tricky = "graph LR\n  A[\"```closed```\"] --> B";
		const out = fencedMermaid(tricky);
		assert.ok(out.startsWith("````mermaid\n"), "the fence is longer than the chart's own run");
		assert.ok(out.endsWith("\n````"));
		assert.ok(out.includes("```closed```"), "the chart source is untouched");
	});
});

describe("md-blocks — copy table round-trips through the real renderer", () => {
	it("gives back the original Markdown from the markup Streamdown produces", () => {
		const md = [
			"| Expression | New objects | Shared with the original |",
			"| --- | --- | --- |",
			"| `a.copy()`, `a[:]`, `list(a)` | the **outer list** | *every* element |",
		].join("\n");
		const html = renderToStaticMarkup(
			React.createElement(
				InteractionLayersProvider,
				null,
				React.createElement(MessageResponse, { mode: "static" }, md),
			),
		);
		assert.ok(html.includes('data-streamdown="inline-code"'), "the renderer really produced code spans");
		const { document } = parseHTML(`<html><body>${html}</body></html>`);
		const table = document.querySelector("table");
		assert.ok(table, "the Markdown produced a table");
		assert.equal(tableToMarkdown(table as unknown as HTMLTableElement), md);
	});
});
