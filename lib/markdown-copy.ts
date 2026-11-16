/**
 * Copy-table / copy-diagram helpers (issue #739).
 *
 * The corner copy on a Markdown block must hand back usable Markdown, not the
 * rendered text. Two sources were broken:
 *
 * - Tables. The old path borrowed streamdown's `extractTableDataFromElement`,
 *   which read every cell with `cell.textContent.trim()` — `<code>`,
 *   `<strong>`, `<em>` and `<a>` were flattened before `tableDataToMarkdown`
 *   ever saw them, so the paste lost the author's formatting. `tableToMarkdown`
 *   reads the real DOM instead.
 * - Mermaid. The copy returned the bare chart source, which pastes as plain
 *   text outside a fence. `fencedMermaid` adds it back.
 *
 * Kept free of React and of the component tree so both the UI and the tests can
 * use it directly.
 */

/** Text that must survive as text: a pipe would split the cell in two. */
const escapePipe = (text: string) => text.replace(/\|/g, "\\|");

/** Longest run of backticks in the text, so a code span can pick a longer
 *  fence and never collide with its own content. */
function backtickRun(text: string): number {
	const runs = text.match(/`+/g);
	return runs ? Math.max(...runs.map((run) => run.length)) : 0;
}

/** Serialize the INLINE content of a node back to Markdown. */
function inlineToMarkdown(node: Node): string {
	if (node.nodeType === 3 /* TEXT_NODE */) return escapePipe(node.nodeValue ?? "");
	if (node.nodeType !== 1 /* ELEMENT_NODE */) return "";
	const el = node as Element;
	const tag = el.tagName.toLowerCase();
	const inner = () => Array.from(el.childNodes).map(inlineToMarkdown).join("");
	switch (tag) {
		case "br":
			// Placeholder: whitespace is folded on the way out, then this becomes
			// a literal <br>, the only line break a Markdown table can carry.
			return "\u0000";
		case "code": {
			// A pipe inside a span still splits the cell in GFM tables, so the
			// escape applies here too (`\|` renders back as `|` in a table).
			const text = escapePipe(el.textContent ?? "");
			const fence = "`".repeat(backtickRun(text) + 1);
			const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
			return `${fence}${pad}${text}${pad}${fence}`;
		}
		case "strong":
		case "b":
			return `**${inner()}**`;
		case "em":
		case "i":
			return `*${inner()}*`;
		case "del":
		case "s":
			return `~~${inner()}~~`;
		case "a": {
			const href = el.getAttribute("href") ?? "";
			return href ? `[${inner()}](${href})` : inner();
		}
		case "img": {
			const alt = el.getAttribute("alt") ?? "";
			const src = el.getAttribute("src") ?? "";
			return `![${alt}](${src})`;
		}
		case "sup":
			return `<sup>${inner()}</sup>`;
		case "sub":
			return `<sub>${inner()}</sub>`;
		default:
			return inner();
	}
}

/** One cell as a single line of Markdown: inline formatting kept, inner block
 *  boundaries folded to a space, newlines surviving only as `<br>`. */
export function cellToMarkdown(cell: Element): string {
	return Array.from(cell.childNodes)
		.map(inlineToMarkdown)
		.join("")
		.replace(/[ \t\r\n]+/g, " ")
		.replace(/ ?\u0000 ?/g, "<br>")
		.trim();
}

/** A cell's column alignment as the Markdown separator: `align` first (the
 *  attribute the Markdown table syntax produces), then the inline style. */
function cellAlign(cell: Element): string {
	const explicit = (cell.getAttribute("align") ?? "").toLowerCase();
	const styled = ((cell as HTMLElement).style?.textAlign ?? "").toLowerCase();
	const value = explicit || styled;
	if (value === "center") return ":---:";
	if (value === "right") return "---:";
	if (value === "left") return ":---";
	return "---";
}

/** The table's own rows, in document order, without touching a nested table's
 *  rows. Plain DOM walking (not `table.rows`) so the serializer behaves the
 *  same in the browser and in the test DOM. */
function tableRows(table: Element): Element[] {
	const rows: Element[] = [];
	for (const child of Array.from(table.children)) {
		const tag = child.tagName.toLowerCase();
		if (tag === "tr") rows.push(child);
		else if (tag === "thead" || tag === "tbody" || tag === "tfoot") rows.push(...tableRows(child));
	}
	return rows;
}

/** A row's own `td` / `th` cells. */
function rowCells(row: Element): Element[] {
	return Array.from(row.children).filter((cell) => {
		const tag = cell.tagName.toLowerCase();
		return tag === "td" || tag === "th";
	});
}

/** The table's corner copy: the REAL DOM table serialized back to Markdown,
 *  with inline formatting and column alignment intact. Replaces streamdown's
 *  `extractTableDataFromElement` + `tableDataToMarkdown` pair (issue #739).
 *  The first row is the header, as Markdown requires. */
export function tableToMarkdown(table: HTMLTableElement): string {
	const rows = tableRows(table);
	if (rows.length === 0) return "";
	// Colspan keeps the column count stable, so the separator row lines up.
	const span = (cell: Element) => Math.max(1, (cell as HTMLTableCellElement).colSpan || 1);
	const width = rows.reduce(
		(max, row) => Math.max(max, rowCells(row).reduce((n, cell) => n + span(cell), 0)),
		0,
	);
	const renderRow = (row: Element) => {
		const cells: string[] = [];
		for (const cell of rowCells(row)) {
			cells.push(cellToMarkdown(cell));
			for (let i = 1; i < span(cell); i++) cells.push("");
		}
		while (cells.length < width) cells.push("");
		return `| ${cells.join(" | ")} |`;
	};
	const header = rows[0]!;
	const alignments: string[] = [];
	for (const cell of rowCells(header)) {
		alignments.push(cellAlign(cell));
		for (let i = 1; i < span(cell); i++) alignments.push("---");
	}
	while (alignments.length < width) alignments.push("---");
	return [
		renderRow(header),
		`| ${alignments.join(" | ")} |`,
		...rows.slice(1).map(renderRow),
	].join("\n");
}

/** The mermaid corner copy: the chart source WRAPPED in its fence, so pasting
 *  it into GitHub, Obsidian or Notion renders a diagram instead of plain text
 *  (issue #739). The fence grows when the chart itself contains backticks. */
export function fencedMermaid(chart: string): string {
	const fence = "`".repeat(Math.max(3, backtickRun(chart) + 1));
	return `${fence}mermaid\n${chart.replace(/\s+$/, "")}\n${fence}`;
}
