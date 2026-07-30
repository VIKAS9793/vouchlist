# VouchList — Go-to-Market Plan

Companion to the [PRD & Case Study](./VouchList_PRD_CaseStudy.md) and [One-Pager](./ONE_PAGER.md). This document covers how VouchList would be launched, messaged, and measured through its pilot phase — the "how it reaches real users" counterpart to the PRD's "what gets built."

---

## 1. Launch Objective

Prove the core retrieval hypothesis — that structured, searchable recommendations beat scrolling WhatsApp history — in a small number of real residential WhatsApp groups, before any investment in scale, monetization, or a dedicated app.

**This is explicitly a validation launch, not a growth launch.** Success is measured in behavior change within a handful of groups, not signups or downloads.

## 2. Target Segment (Pilot)

| Criterion     | Definition                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Geography     | Andheri–Borivali residential corridor, Mumbai                                                                                |
| Group profile | Active society/building WhatsApp groups (50–300 members) with visible, frequent "does anyone know a good X" message patterns |
| Champion      | A society admin or highly active resident willing to opt the group in and vouch for the bot early                            |
| Exclusions    | Groups with low message activity (no organic demand signal) or strict no-bot / no-third-party-tool admin policies            |

## 3. Positioning

**For** residents of dense Mumbai housing societies **who** lose valuable local recommendations in fast-scrolling WhatsApp chats, **VouchList is** a WhatsApp-native bot **that** turns those recommendations into a permanent, searchable group directory. **Unlike** a new app, marketplace, or admin-run noticeboard, **VouchList** requires zero switching cost — it lives inside the chat residents already trust.

### Core message (one line)

_"Your neighbors already know. VouchList remembers."_

### Supporting messages

- "No new app. No new habit. Just retrieval for what your group already knows."
- "Structured trust, inside the chat you already use."
- "Search engines answer the world. VouchList answers your street."

## 4. Channels & Sequencing

| Phase                       | Channel                                                                  | Purpose                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 — Manual validation | Direct, 1:1 outreach to a single society admin                           | Test the retrieval hypothesis manually (pinned doc), zero engineering cost                                                               |
| Phase 1 — Pilot             | Direct outreach to 3–5 society admins/committees (warm intros preferred) | White-glove onboarding; high-touch, not scalable by design                                                                               |
| Phase 1 (parallel)          | LinkedIn — case study posts documenting the build in public              | Builds a credible public trail (problem → prototype → landing page) that doubles as admin-facing social proof and PM-audience engagement |
| Phase 2+                    | Resident-to-resident referral (natural relocation within corridor)       | Only after Phase 1 metrics validate retention; no paid acquisition planned before this                                                   |

**Note:** the LinkedIn case-study thread (the posts and this repo) is not incidental — it is a deliberate part of GTM. It builds public credibility with the _next_ society admin before the first cold outreach message is even sent.

## 5. Onboarding Flow (Admin → Group)

1. Admin is shown the landing page and a short explanation of consent and data handling.
2. Admin opts the group in; bot posts a one-time, plain-language introduction message to the group (per FR-1, FR-9 in the PRD).
3. Bot operates passively — no behavior change required from members until they naturally trigger it by asking or answering a recommendation-style question.
4. Any member can mute the bot at any time without leaving the group — removes the single largest objection (unwanted bot noise) before it can arise.

## 6. Launch-Readiness Checklist

- [ ] Consent/intro message copy reviewed for plain-language clarity (no jargon, explicit opt-out instructions)
- [ ] Landing page live and consistent with in-chat messaging (see PRD Section 7 risk: minimal-data claim vs. waitlist fields — resolve before pilot)
- [ ] At least 1 seed society admin confirmed for Phase 0 manual test
- [ ] Metrics instrumentation plan defined for Resolved Asks (PRD Section 8) before Phase 1 bot deployment
- [ ] Abuse/spam guardrail (FR-8) functional before any group goes live

## 7. Success Criteria & Kill Criteria

| Outcome              | Signal                                                                       | Decision                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Green light**      | Resolved Asks and retention targets in PRD Section 8 met by week 8           | Proceed to Phase 2 hardening and expansion planning                                                        |
| **Yellow — iterate** | Activation succeeds but engagement/retention below target                    | Revisit intent-detection threshold, prompt UX, or category scope before scaling outreach                   |
| **Red — kill/pivot** | Opt-out rate exceeds guardrail (>8%) or Resolved Asks stays flat past week 4 | Stop pilot expansion; return to Phase 0 manual validation to re-test the core hypothesis before rebuilding |

## 8. Post-Launch

A structured retro is planned at the end of the 8-week pilot, comparing actual metrics against the targets defined in the PRD, documenting what was predicted correctly, what wasn't, and what changes before any Phase 2 decision.

---

_Author: Vikas Dayashankar Sahani — [LinkedIn](https://www.linkedin.com/in/vikas-sahani-727420358) · [Portfolio](https://myportfoliohubexpo.netlify.app)_
