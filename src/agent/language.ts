/**
 * zh-CN localization seam (Chinese release).
 *
 * The product ships a Simplified-Chinese interface, so every learner-facing
 * model reply must be written in Simplified Chinese regardless of the
 * language of the prompt fragments, the learner's files, or the source
 * material. The directive is APPENDED at composition time — the prompt
 * fragments under src/agent/**\/*.md stay byte-identical to upstream, so an
 * upstream prompt update never conflicts with the localization.
 *
 * Applied at every model entry point that produces learner-visible text:
 * the main teacher/prober/practice agents (composeInstructions), subagent
 * runs (runSubagent), the side thread, and plugin agents.
 */
export const LANGUAGE_DIRECTIVE =
	"Write every learner-facing message in Simplified Chinese (简体中文) — replies, questions, options, explanations, summaries, plan and artifact titles. Keep code, file paths, identifiers, and technical terms in their original form.";

/** Append the language directive to a composed system prompt. */
export function withLanguage(prompt: string): string {
	const trimmed = prompt.trim();
	return trimmed ? `${trimmed}\n\n${LANGUAGE_DIRECTIVE}` : LANGUAGE_DIRECTIVE;
}
