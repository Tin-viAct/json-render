/**
 * Contract for a pluggable agent prompt-mode adapter.
 *
 * Each adapter owns a self-contained instruction block that gets concatenated
 * into the agent's system prompt. New modes (EPTW, ECMP, DWSS, etc.) can be
 * added by dropping a new adapter file and importing it in `agent.ts`,
 * without touching unrelated prompt content.
 */
export interface PromptAdapter {
  /** Stable machine identifier, e.g. `"eptw-form"`. */
  name: string;
  /** Short human-readable purpose of this prompt mode. */
  description: string;
  /** Instruction block injected into the agent system prompt. */
  prompt: string;
}
