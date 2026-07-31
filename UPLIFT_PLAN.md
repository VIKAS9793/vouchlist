# VouchList — Uplift Plan

**Purpose of this file:** a task list for AI coding agents (Claude Code, Cursor, or similar) and human contributors to bring `src/`, `docs/`, and `README.md` into alignment with what has actually been built and validated. Every task below exists because something in the repo currently overstates, understates, or fails to state the real status of the work.

**Ground rule for every task:** if a change would require inventing a number, a result, or a capability that doesn't exist yet, do not invent it — mark it as `TBD`, `Not yet measured`, or `Planned`, and open a tracking task instead. The goal of this plan is to remove fabrication, not relocate it.

---

## 0. Source of Truth: Current Phase

Before touching any file, every agent working on this repo must treat the following as fact and must not contradict it in any doc, comment, or copy change:

> **VouchList is currently in Phase 0 — Demand Validation.**
> The live site (`vouchlist.lovable.app`) is a **smoke-test landing page**, not the product. Its job is to measure real interest (page visits, CTA clicks, waitlist signups, signup intent quality, content engagement, geographic distribution) *before* any WhatsApp bot is built. **No bot exists. No pilot has run. No society has used this. All PRD pilot targets (activation %, capture rate, Resolved Asks) are planning assumptions, not findings**, and must be labeled as such everywhere they appear.

> **This GitHub repository is a curated public mirror, not the live or authoritative codebase.**
> The working prototype, Lovable's own agent/sync configuration, and the deployed environment all live on Lovable's own hosted infrastructure. This repo is a deliberately modified copy published for public viewing (portfolio, code review, hiring context) — it is **not intended to be cloned and run standalone**, and gaps between what's here and a fully runnable local instance (missing backend credentials, environment config, etc.) are expected and by design, not bugs. This distinction must be stated plainly for any visitor — see DOC-8.

Any document, comment, or UI copy that implies otherwise (a working bot, a completed pilot, measured retention, an active community, or a runnable production clone) is a defect and should be corrected as part of this plan, not left as-is for "polish later."

---

## 1. Documentation Uplift

### DOC-1 — README: state the phase explicitly, above the fold
**Why:** the README currently reads like a launched-product marketing page. A visitor has no way to tell this is a pre-bot smoke test without reading deep into the PRD.
**What to change:** add a short, unmissable callout near the top of `README.md` (before the feature/media section) stating the current phase in plain language — what exists (landing page, waitlist, analytics instrumentation), what doesn't (the bot), and what the site is currently being used to learn.
**Acceptance criteria:** a first-time reader understands within 10 seconds of opening the README that this is a demand-validation instrument, not a live product.

### DOC-2 — PRD: label every unmeasured target as an assumption
**Why:** `VouchList_PRD_CaseStudy.md` presents Phase 1 pilot targets (≥40% activation, ≥50% capture rate, 1.5x retention growth, etc.) with the same declarative confidence as the problem statement, with no visual or textual distinction between "decided" and "assumed."
**What to change:** every numeric pilot target in Section 8 (Success Metrics) gets an explicit `Assumption — not yet measured` tag or callout. Add one sentence at the top of Section 8 clarifying that these are hypotheses to be tested in Phase 1, once the bot exists, not results.
**Acceptance criteria:** no number in the PRD can be mistaken for an observed result by a reader skimming the document.

### DOC-3 — PRD/GTM: add the smoke-test rationale as its own section
**Why:** the sequencing logic (validate demand with a landing page before building the bot) is sound product strategy, but it currently lives only in conversation, not in any document. A reviewer has to take it on faith or infer it.
**What to change:** add a short "Why a landing page first" section to either the PRD or `GTM.md`, explaining the fake-door/smoke-test rationale explicitly: what's being measured, what threshold would justify building the bot, and what threshold would kill or pivot the idea.
**Acceptance criteria:** the go/no-go logic for moving from Phase 0 to Phase 1 is written down, not implied.

### DOC-4 — Define and document the actual Phase 0 success criteria
**Why:** Section 8 of the PRD defines success criteria for the *bot pilot* (Phase 1), but there is no defined success criteria for the *landing page* itself (Phase 0) — the phase actually in progress right now.
**What to change:** add a small table to `GTM.md` or the PRD defining what a "successful" Phase 0 looks like using only metrics the current site can actually produce: waitlist conversion rate, CTA click-through, average session/content engagement, geographic concentration, signup quality (e.g., % with a real community/city filled in vs. blank).
**Acceptance criteria:** there is a documented, numeric bar for "demand validated, proceed to build the bot" that uses only data the current instrumentation can produce.

### DOC-5 — Correct the coverage badge or the claim around it
**Why:** the README displays a unit test coverage badge showing 9%, without commentary — this reads as either an oversight or an attempt to look more tested than the repo is.
**What to change:** either raise coverage meaningfully (see ENG-1 through ENG-3 below) before displaying the badge prominently, or add a one-line caption next to the badge stating current scope honestly (e.g., "server-side guard logic only; component/e2e coverage in progress").
**Acceptance criteria:** the badge cannot be read as a claim of broad test coverage without qualification.

### DOC-6 — Disclose the Lovable/AI-assisted build process
**Why:** `AGENTS.md` discloses that this repo is Lovable-connected, but the README (what most reviewers actually read) does not mention this at all.
**What to change:** add a short, factual paragraph to the README (e.g., near "Owned and built by") describing the build process: AI-assisted scaffolding via Lovable, with the author directing architecture, reviewing/editing output, and owning product and security decisions. Do not overstate ("100% hand-written") or understate ("fully autonomous AI build") — describe the actual division of labor.
**Acceptance criteria:** a reader cannot come away thinking the code was entirely hand-typed line by line, nor that it was generated with no human review.

### DOC-7 — Reconcile LinkedIn/marketing copy with actual phase
**Why:** external copy ("Structured Trust. Inside the chat you already use.") describes the bot as if it's operating today; the repo and PRD both confirm it is not.
**What to change:** this is not a repo file change, but should be tracked here as a task: update or caption external landing-page/social copy so present-tense claims about the bot's behavior are reframed as the vision/roadmap, not current capability (e.g., "Here's how it will work" vs. "Here's how it works").
**Acceptance criteria:** no external-facing copy describes bot behavior in the present tense as something a user can experience today.

### DOC-8 — State plainly that this repo is a public mirror, not a runnable clone
**Why:** nothing in the README currently tells a visitor that this GitHub repository is a deliberately modified public copy, that the live/working prototype and Lovable's sync/agent tooling live on Lovable's own hosted infrastructure, and that this repo is not meant to be cloned and run standalone. A visitor who clones it expecting a working local app will hit unexplained gaps (missing backend credentials, no working Supabase connection, etc.) with no context for why.
**What to change:** add a short, clearly labeled note near the top of `README.md` (can sit alongside DOC-1's phase callout) stating: this repo is a curated public mirror for viewing/portfolio purposes; the authoritative, deployed, and Lovable-synced codebase lives on Lovable's platform; cloning this repo will not produce a fully functional local instance without additional setup the repo does not currently document or support.
**Acceptance criteria:** a visitor who reads the top of the README before cloning understands this is a showcase copy, not a get-it-running-locally project, and understands why any missing pieces (env vars, live sync, agent config) are absent by design.

---

## 2. Code & Test Uplift

### ENG-1 — Wire the existing Playwright e2e suite into CI
**Why:** 16 e2e specs exist in `e2e/` but `ci.yml` only runs `vitest run`. The suite currently provides zero regression protection because nothing enforces it stays green.
**What to change:** add a job (or step) to `.github/workflows/ci.yml` that runs `playwright test` (or the existing `qa:e2e` script) on every push/PR, with appropriate browser install step (`playwright install --with-deps`) and a reasonable timeout.
**Acceptance criteria:** a PR that breaks an existing e2e spec fails CI, not just local runs.

### ENG-2 — Add component-level tests for the highest-risk UI surface
**Why:** all current unit tests cover server-side `lib` guard logic only; there is no test for `WaitlistForm.tsx`, `OnboardingTour.tsx`, or any hook — the actual product surface a user interacts with.
**What to change:** add unit/integration tests (Vitest + Testing Library or equivalent) for at minimum: `WaitlistForm` (happy path submit, validation errors, focus management, duplicate/rate-limit error states) and `waitlist.ts` client helper.
**Acceptance criteria:** the two highest-traffic interactive components in the app have direct test coverage, not just their downstream server functions.

### ENG-3 — Raise and honestly report coverage
**Why:** current line coverage is 9%; the badge is displayed without context (see DOC-5).
**What to change:** after ENG-2, re-run `test:coverage` and `coverage:badge`; do not hand-edit the badge — let it reflect the real number. If the number is still low after reasonable additions, that's acceptable as long as DOC-5's caption is honest about scope.
**Acceptance criteria:** the badge value is generated, not asserted, and matches an honest scope statement.

### ENG-4 — Add a root-level error boundary
**Why:** no error boundary exists anywhere in candidate-authored code (only inside vendored shadcn/ui internals); an unhandled render error currently takes down the whole page with no fallback UI.
**What to change:** add an error boundary at or near `src/routes/__root.tsx` with a minimal, on-brand fallback UI and an error-capture hook into the existing `src/lib/error-capture.ts` / `error-page.ts` utilities if they're not already wired for this.
**Acceptance criteria:** a thrown render error in any route shows a fallback screen instead of a blank/crashed page, and is captured through existing error-reporting utilities.

### ENG-5 — Reduce `any` usage and re-enable unused-var linting
**Why:** `tsconfig.json` claims `strict: true` but disables `noUnusedLocals`/`noUnusedParameters`, and 24 instances of `any`/`as any` exist in `src`, undermining the strictness claim.
**What to change:** re-enable `noUnusedLocals` and `noUnusedParameters`; fix resulting lint errors; replace `any` with proper types or `unknown` + narrowing where feasible. Where an `any` is genuinely unavoidable (e.g., a loosely-typed third-party client), keep it but add a one-line comment explaining why, consistent with the existing `AdminClient` pattern in `waitlist.server.ts`.
**Acceptance criteria:** `any` usage is reduced to only justified, commented cases; `tsconfig.json` strictness flags match actual enforced behavior.

### ENG-6 — Document and justify remaining `eslint-disable` comments
**Why:** 12 `eslint-disable` comments exist with no consistent justification or linked context.
**What to change:** for each remaining `eslint-disable`, add a one-line comment explaining why the rule is being overridden at that specific location (not a blanket disable).
**Acceptance criteria:** every `eslint-disable` in the codebase is self-explanatory without needing to ask the author.

### ENG-7 — Add lightweight server-side validation for analytics-driven decisions
**Why:** GA4 events are currently client-side only; if Phase 0 signup/CTA/geo data is being used to decide whether to build the bot (per DOC-3/DOC-4), that data should not be fully spoofable by ad blockers or bots with no server cross-check.
**What to change:** at minimum, cross-reference GA4 signup counts against the authoritative `waitlist` table row count (already server-validated with RLS + rate limiting) when reporting Phase 0 results, rather than trusting GA4 numbers alone. Document this reconciliation step in `GTM.md` or a new `docs/product/PHASE_0_RESULTS.md` (create when real data exists — do not pre-fill with numbers).
**Acceptance criteria:** any future demand-validation "go" decision cites the server-side waitlist count as the primary source of truth, with GA4 used only for funnel/engagement context.

### ENG-8 — Wire remaining QA scripts into CI or explicitly mark them manual
**Why:** `package.json` defines many `qa:*` scripts (security, a11y, perf, deps, rls, secrets, links, seo) that exist but are not part of the enforced CI gate (`ci.yml` only runs lint + unit tests + build).
**What to change:** either add the highest-value scripts (`qa:security`, `qa:a11y`, `qa:secrets`) to CI, or add a short note in `README.md`'s contribution/QA section stating which QA scripts are CI-enforced vs. run manually pre-release, so the gap is documented rather than silent.
**Acceptance criteria:** no reader can assume a `qa:*` script runs automatically unless it's actually wired into `ci.yml`.

---

## 3. Repository Hygiene — Never Commit Internal or Agent Files

**Why:** internal tooling artifacts — AI agent instructions, skill definitions, prompt scaffolding, internal memos, or platform-sync files — are working infrastructure for whoever is building the repo, not product artifacts. They should never reach a public remote, because they expose internal process, tooling choices, or instructions never meant for an external reader (recruiter, hiring manager, or contributor), and they clutter the signal of what the repo is actually meant to demonstrate.

**Rule, effective immediately and permanently:** no file matching any of the following categories may ever be committed to this repository, in any branch, at any time — not as documentation, not as a memo, not inside `docs/`, and not inside `src/`:

- AI coding-agent instruction files (e.g., `SKILL.md`, `CLAUDE.md`, `.claude/`, `.cursor/`, `.windsurf/`, `.aider*`, `copilot-instructions.md`)
- Internal build-platform sync/agent files not required for the product itself to function (e.g., Lovable's `AGENTS.md` — see conflict note below)
- Internal planning memos, scratch notes, prompt logs, or draft reasoning not intended for public reading (`scratch/`, `notes/`, `*.local.md`, `TODO.local*`)
- Any file containing raw prompts, system instructions, or agent configuration used to generate parts of this codebase

**Enforcement:**
1. Confirm every pattern above is present in `.gitignore` (most already are — see below).
2. Before any commit or PR, run a check for these patterns against staged files (a simple pre-commit grep/find is sufficient; do not rely on `.gitignore` alone, since already-tracked files bypass it).
3. If such a file is discovered already committed in history, it must be removed from the current tree in a dedicated commit (`chore: remove internal tooling file from repo`) and, if it contains anything sensitive, purged from history separately (out of scope for this plan, escalate to the repo owner directly rather than force-pushing history without sign-off — see the force-push warning already present in `AGENTS.md`).

**Current repo status (verified against `.gitignore` as of this plan):**
- `.lovable/`, `.workspace/`, `.agents/`, `.claude/`, `.cursor/`, `.windsurf/`, `.aider*`, `CLAUDE.md`, and `.github/copilot-instructions.md` are already excluded. Good — no action needed there.
- **Resolved: `AGENTS.md` should be removed.** It was previously kept under an assumption that Lovable's project sync depends on this GitHub repo. That assumption is false: this GitHub repository is a deliberately modified, curated **public mirror** of the product code — the live, working prototype and Lovable's own sync/hosting happen on Lovable's own servers/cloud, independent of this repo. Since sync does not run through this public copy, `AGENTS.md` serves no function here and should be deleted in the same commit that removes any other stray internal file. Remove the now-outdated `.gitignore` comment alongside it.

**Acceptance criteria:** no internal agent/tooling file is discoverable in the tracked repository tree. `AGENTS.md` is removed, and the `.gitignore` comment referencing it as an exception is deleted.


## 4. Priority Order

Work top to bottom; each phase should be a separate PR so the "no fabrication" principle can be verified incrementally.

1. **HYG-1 (Section 3)** — remove `AGENTS.md` and the related `.gitignore` exception comment. This is now a clean, resolved removal, not a pending decision, and should be closed first.
2. **DOC-1, DOC-8, DOC-2, DOC-3, DOC-4** — fix the story before fixing the code: state what this repo is (public mirror, current phase) before addressing what's in it. These are the items a reader/interviewer hits first.
3. **DOC-5, DOC-6** — close the two specific credibility gaps (coverage badge, AI-build disclosure).
4. **ENG-1, ENG-4** — cheapest, highest-leverage engineering fixes (wire existing tests into CI; add the missing error boundary).
5. **ENG-2, ENG-3** — real coverage improvement, reported honestly.
6. **ENG-5, ENG-6** — type/lint hygiene.
7. **ENG-7, ENG-8, DOC-7** — instrumentation integrity and remaining QA/marketing alignment.

---

## 5. Definition of Done for This Uplift Plan

This plan is complete when:

- No internal agent, skill, or tooling instruction file is committed to the repository. `AGENTS.md` has been removed.
- A first-time visitor to the repo (README) can state, without reading any other file: (a) the current product phase, and (b) that this is a curated public mirror, not a runnable clone of the live app.
- No PRD or GTM number can be mistaken for a measured result.
- CI failure means something is actually broken — not "the e2e suite wasn't invited to the party."
- The coverage badge reflects real, current, honestly-scoped coverage.
- Every `any` and `eslint-disable` in the codebase is either removed or justified inline.
- Nothing in this repository, if read end-to-end by a skeptical reviewer, contradicts anything else in it.

---

*This plan exists to close the specific gaps surfaced during an external portfolio review (see `docs/product/VouchList_PRD_CaseStudy.md` for the underlying product thinking). It should be updated or retired once Phase 0 concludes and a real go/no-go decision on building the bot has been made and documented.*
