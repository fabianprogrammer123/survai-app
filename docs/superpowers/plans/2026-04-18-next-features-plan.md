# Next Features Plan — 2026-04-18

Synthesis of four parallel audits (creator flow, respondent flow, AI-native critique, technical foundation) into a prioritized roadmap, with UX thinking folded in. Written after a session that just shipped: share-dialog fix, default "publish without AI responses" toggle, chat-preview → editor-section linking, icon-driven question type change, and voice transcription landing in the textbox instead of auto-sending.

## Where we are

**Shippable and credible.** Single-creator flow from blank form → AI-generated questions → publish → voice/web/phone distribution works. Ten+ element types. Two layout presets (Google Forms, Typeform). Chat generates proposals with rationale, streams them onto the canvas, lets you jump from an insight card to the corresponding section. Mobile responsive. Voice input, voice output, voice agent, phone campaigns — plumbing is wired end-to-end.

**Obvious seams.**
- The editor is local-only — edits don't auto-sync to Supabase; losing your browser tab loses unsaved work.
- "Preview link" vs. "published link" send mixed messages to respondents ("responses won't appear" / "responses aren't saved" — different wording, both warning the same thing).
- Phone campaign UI is a form; once you hit Start there's no "how's it going" view.
- Results view exists but doesn't yet drill down conversationally.
- Known open bug: `undefined` sneaks into `survey.elements` during streaming; symptom is hotfixed with scattered `el && ...` guards, root cause is in the streaming path (best theory: sparse arrays from `hydrateBlueprint` reaching `handleProposalSelect`'s for-of loop).
- 22 `any`-type escape hatches cluster in `properties-panel.tsx` and `type-conversion.ts` — the element-update plumbing.
- No unit tests. Playwright visual smokes exist but not in CI.

## The bigger UX question

Before listing features, it's worth asking what kind of tool survai is growing into, because that choice reframes the roadmap.

**A form builder with AI helpers** (today). The creator drafts a survey; AI accelerates drafting and seeds fake responses. The respondent sees a form. Voice is an alternate mode. Results are charts.

**An AI research conversation with a form artifact** (the bolder reading). The creator declares a *research goal* and *constraints*; the AI interviewer conducts adaptive conversations with respondents — following up on interesting answers, skipping inapplicable ones, summarizing aggregate findings back. The "survey" is an output of that system, not the primary thing.

The code has ingredients of both. The `aiContext` (goal + strictness) seeded into prompts, the voice agent, the AI results analysis — these lean towards the second reading. The rigid-question form, the fixed results schema, the one-shot publish — these anchor the first.

The audits converge on a consistent implication: **the next wins come from closing feedback loops**, not adding more element types. Every AI surface today is one-shot — propose → apply, publish → deployed, query results → one answer. Iteration is where AI becomes a collaborator rather than an autocomplete. Both readings above benefit; the "research conversation" reading requires it.

Recommendation: ship Horizon 1 + 2 below as the natural path forward regardless of framing, and decide Horizon 3 after Horizon 2 reveals what creators and respondents actually do with a tool that feels alive.

## Principles for AI-native survey UX

### For the creator

1. **Start with the goal, not the questions.** Capture "what are we trying to learn, from whom, and what decisions does it inform" before seeding question generation. This is half-there via `aiContext` — make it first-class.
2. **Propose in variations, commit in atoms.** Creators should be able to accept one question from a proposal without the whole thing, remix two proposals, or re-ask with new constraints. Current "Option A/B/C" is disposable — lean in.
3. **Targeted edits beat regeneration.** "Change this one word" should never regenerate the whole survey. The command path (`move_element`, `update_element`) should be visible and reversible, so creators trust it.
4. **Show what the AI understood.** Rationale cards are a good start. Next: a "what did you infer about my audience / my goal" summary the creator can correct.
5. **Preview should be trustworthy.** If a share link is preview-only, say so once and clearly — not twice with different wording.

### For the respondent

1. **Answering is labor. Reduce it.** Autosave, skip-logic, session resume, good mobile — these are table stakes but not yet met.
2. **Voice is only compelling when it beats typing.** For long-form qualitative answers and on-the-go mobile, voice is faster and richer. For "pick a number 1-5" it's slower. Let respondents switch modes per-question, not once per survey.
3. **Confirm before submitting.** Especially for voice — show a read-back ("here's what I heard — is this right?") before the conversation ends. Today the voice flow ends on `onDisconnect` with no confirmation.
4. **Failure must be visible.** A silent submit failure is worse than an ugly retry dialog.
5. **Adaptive > rigid.** The AI can probe interesting answers, skip irrelevant questions, and adjust tone — but only if the schema allows it. Today, questions are fixed at publish time. Consider a "topics + guardrails" mode alongside "fixed questions" mode.

## Themes across the audits

**T1. Persistence is the unblocker.** Editor state → Supabase autosave; responses → real DB; published surveys → stable `/s/:id`; preview links → unambiguous (or retired). The four audits independently surfaced "coming soon" / "not yet persisted" / "lost on refresh" in different shapes. All point at the same missing foundation.

**T2. Feedback loops are where the product becomes a tool.** Creator sees AI command result + can undo. Creator hears a real voice call + refines the agent. Creator asks a follow-up question in results mode and the dashboard updates. Respondent reviews voice-captured answers before submit. Each loop turns a one-shot surface into a collaboration.

**T3. Trust gaps compound.** The `undefined` elements symptom, the voice-submit invisibility, the generic submit-error message, the ambiguous preview messaging, the `any`-casts in properties-panel — none individually disqualifies the product, but together they add up to "does this thing actually work?" Fixing them is UX *and* quality work.

**T4. Single AI persona.** Builder AI, voice agent, results AI are three different voices. Unifying the persona (shared memory of what the survey is *for*, consistent tone, traceability from goal → question → response → insight) makes the product feel like one collaborator, not three separate integrations.

## Roadmap

Three horizons. Each one has the previous as prerequisite.

### Horizon 1 — Foundations (target: next 2-3 weeks)

Focus: fix trust gaps, wire persistence, get tests under the most-mutated code paths.

| # | Item | Why | Source |
|---|------|-----|--------|
| 1.1 | **Fix `undefined in survey.elements` at source.** Validate `proposal.elements` before the `handleProposalSelect` loop; make `hydrateBlueprint` return a non-sparse array with a type guard. Remove the `el && ...` hotfixes. | Silent data loss under streaming; every new feature inherits the footgun. | creator, AI, tech |
| 1.2 | **Editor autosave to Supabase.** Debounced upsert of `survey` on change. On load, prefer DB over localStorage when both exist. | Closing the tab loses unsaved work. Prerequisite for multi-device, later collab. | creator, tech |
| 1.3 | **Publish → stable `/s/:id`.** The base64 preview URL continues to exist, but "Publish" creates a persistent row and a short URL. Respondent submissions write to `responses`. | The "preview link" vs "real link" confusion is a creator trust problem. | respondent, tech |
| 1.4 | **Web form: session resume + answer autosave.** localStorage on `answers + currentPage`; on return, "continue from page 3 of 5?" | Standard in Typeform / Google Forms. Biggest abandonment reducer. | respondent |
| 1.5 | **Voice submit confirmation.** After `onDisconnect`, before "Thanks!", show a read-back of captured answers. "Re-answer Q3" / "Looks right — submit." | Silent voice data capture erodes trust. | respondent, AI |
| 1.6 | **Remove `any`-casts in properties-panel + type-conversion.** Discriminated unions per element type; typed updaters. | 22 escape hatches in element update paths will corrupt state as we add types. | tech |
| 1.7 | **Store unit tests (Vitest).** `addElement`, `replaceElements`, `sanitizeElements`, `applyGeneration`. Plus a regression test for #1.1. | Any refactor of the streaming path without these is a gamble. | tech |
| 1.8 | **Tool-call logging via Claude Code hooks.** `PostToolUse` + `SubagentStop` → JSONL at `.claude/logs/<session>.jsonl`. Project-scoped settings. | Direct ask from last user message; also sets us up for audit/eval. | meta |

Acceptance: no `el && ...` guards survive. `tsc --noEmit` shows zero `any` in properties-panel. Autosave works across a tab refresh. `/s/:id` link works from one device to another with responses persisting.

### Horizon 2 — AI collaboration loops (target: month 2)

Focus: make each AI surface iterative, not one-shot.

| # | Item | Why | Source |
|---|------|-----|--------|
| 2.1 | **Element-scoped chat: "Refine this question."** Right-click / context menu on an element → chat opens with that element's id in context. AI can propose targeted edits. Commands are shown as pending (preview tile + Accept/Undo) before applying. | Closes the chat ↔ editor gap. Makes commands visible and reversible. | creator, AI |
| 2.2 | **Iterative results drill-down.** Results chat carries history. "Show text feedback for Q5" / "Compare by region" / "Highlight outliers" refine the dashboard turn-by-turn; A2UI specs update in place. | Turns results from one-shot to investigation. | AI |
| 2.3 | **Voice agent refinement from transcripts.** Expose recent call transcripts in a side panel; creator can prompt "Probe more on Q2" and the agent's system prompt is regenerated. | Closes the biggest AI feedback loop; ElevenLabs already returns logs. | AI |
| 2.4 | **Phone campaign status + real-time.** Poll the ElevenLabs batch status endpoint; show in-progress / completed counts; surface completed call transcripts in-app. | Phone campaign is currently fire-and-forget in the UI. | respondent, AI |
| 2.5 | **Unified AI persona / memory.** The builder AI, voice agent, and results AI share a summary of `survey.goal` + `audience` + `decisions_to_inform`. Voice agent warms up with that context; results AI frames findings against it. | Makes the product feel like one collaborator. | AI |
| 2.6 | **Quality pass on voice mode for complex question types.** Matrix, ranking, Likert don't map cleanly to voice single-choice today. Either skip them in voice mode (with explicit "best in web form") or design voice-native equivalents. | `agent-builder.ts` currently collapses them to free text. | respondent, AI |

Acceptance: a creator can iterate on an element without regenerating the whole survey. A respondent hears a voice agent that was refined once after the creator listened to earlier calls. A creator drills into results over 3-5 follow-up questions and watches the dashboard update.

### Horizon 3 — Adaptive surveys (target: month 3+, evaluate after H2)

Focus: decide whether to lean into "AI research conversation with a form artifact" as the product's shape.

| # | Item | Why | Source |
|---|------|-----|--------|
| 3.1 | **"Topics + guardrails" survey mode.** Creator defines a research goal, a set of topics to cover, and guardrails (avoid these, must ask these). AI conducts conversations adaptively — follow-ups, skips, re-asks. Output: structured summaries per topic, not per fixed question. | The reframe. Only worth it if H2 shows creators want adaptive behavior. | UX bet |
| 3.2 | **Branching / conditional logic for fixed-question mode.** Skip logic, page-level conditionals, dependent-question visibility. | Even in fixed-question mode, rigid paths feel dated. | creator |
| 3.3 | **Multi-creator collab on a survey.** Presence, comments on elements, change history. | Requires H1 persistence to exist first. | creator |
| 3.4 | **Analytics over research goals.** "Did we answer: are users willing to pay?" — an AI view that ranks findings against the creator's original `survey.goal`. | Closes the loop from goal → publish → result against goal. | AI |

## What not to ship on top of without fixing first

From the technical audit, in priority order — these are the "you'll regret it" items:

1. The `undefined` elements streaming bug (H1.1)
2. `any`-casts in element-update plumbing (H1.6)
3. Editor state DB sync (H1.2) — without this, real-time collab (H3.3) is impossible
4. Store unit tests (H1.7)
5. `OrgFlowCanvas.tsx` — 993 lines, before adding heatmap/drilldown visualizations

## Measures of success

- **Creator:** time from "blank form" to "first respondent hits the link" — target under 5 minutes.
- **Respondent:** completion rate on a 5-question survey — target 70%+ (today unknown, unmeasurable without persistence).
- **AI:** creator-reported iteration count per survey (how many times did the creator re-ask the AI to change something). Higher is good if satisfaction is high — indicates a collaborator.
- **Trust:** zero `undefined`-related Sentry errors over a rolling 30-day window after H1.1 ships.
- **Test coverage:** store unit tests covering the 6 mutation functions in `store.ts`; each mutation has at least one "malformed input" case.

## Dependencies across items

```
1.1 (undefined fix)  ──► 1.7 (store tests regression)
1.2 (autosave)       ──► 1.3 (stable /s/:id)  ──► 1.4 (respondent resume)
1.5 (voice confirm)  ──► 2.6 (voice quality pass)
1.6 (remove any)     ──► 2.1 (element-scoped chat)
H1 complete          ──► H2 begins
H2 complete          ──► H3 decision
```

## Threading recommendation for the next sessions

Based on the pattern that worked this session (parallel Explore subagents auditing independent axes, main thread synthesizing, one plan doc as durable output):

- **Planning / strategy work:** main thread with parallel research subagents per axis.
- **Independent implementation work:** parallel implementer subagents in isolated worktrees (Agent tool supports `isolation: "worktree"`). Good candidates from H1: 1.1, 1.2, 1.4, 1.6, 1.7 are largely independent.
- **Verification fanout:** every "done" claim triggers parallel `tsc`, `eslint`, `next build`, and `playwright` — not sequential.
- **Tool-call logging (H1.8):** commit early in H1 so the rest of H1 is logged end-to-end. Retrospective on whether full-verbose (args + results) or summary (name + timing) is the right level.
