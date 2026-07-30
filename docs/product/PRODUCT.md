# VouchList: product context

Reference for anyone working on this website. It captures the product decisions the copy is
expected to stay aligned with, so that marketing claims never drift from the product.

Owned and built by Vikas Dayashankar Sahani (vikassahani17@gmail.com).
Scope: Phase 1 pilot, 2026, Andheri to Borivali corridor, Mumbai.
Last reviewed: July 2026.

## 1. Core insight

Recommendations inside WhatsApp society groups are trusted but ephemeral. The failure mode is
information decay, not a lack of platforms. Therefore VouchList lives inside WhatsApp and
adds structure and retrieval, rather than asking anyone to move.

## 2. Personas

| Persona                                   | Context                                                     | Core need                                                                              |
| ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Priya, 34, working parent, Andheri        | Active in two or three society and parent groups, time poor | Fast, low-risk decisions for home and child-care services without vetting from scratch |
| Rajesh, 58, long-time resident, Kandivali | High social trust, answers requests often                   | A low-effort way to make his knowledge reusable instead of retyping it                 |
| Sana, 27, new resident, Borivali          | No chat history or social capital yet                       | Access to the society's collective trust without needing to know people first          |
| Society admin or committee member         | Runs the group and the noticeboard                          | Less repeat-question load and an always-current reference                              |

### Jobs to be done

- Asker: when I need a local service or item fast, I want to see what my neighbours already
  trust, without scrolling or re-asking, so I can decide with confidence in minutes.
- Responder: when I recommend something, I want that answer to keep helping people after I have
  typed it once, so my local knowledge is not wasted when the chat moves on.

## 3. Alternatives and why they fall short

| Alternative                      | Does well                                         | Fails this job                                                            |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| WhatsApp groups (status quo)     | Zero friction, existing trust, universal adoption | No search or structure, recommendations decay in days, constant re-asking |
| Urban Company                    | Verified professionals, ratings, booking          | Not peer vouched, commission based, overkill for casual asks              |
| NoBrokerHood, MyGate             | Official admin communication, visitor management  | Admin run and institutional, not built around organic recommendations     |
| Marketplace and classifieds apps | Broad reach for buying and selling                | Trust is not scoped to the building, safety concerns with strangers       |

## 4. The loop

1. A resident asks the group for a service or item.
2. A neighbour answers as they always would.
3. The bot prompts that responder with a one-tap action to add the answer to the list.
4. On confirmation the entry is structured: category, name and contact, one-line reason,
   submitter.
5. The entry joins a persistent, pinned, searchable list scoped to that group.
6. Future requests in the same category surface the entry automatically, with the option to
   still ask the group live.

Retention is structural, not incentive based. Each entry compounds the list's value for the
whole group.

## 5. Non-functional commitments referenced on the website

- Privacy: the bot processes messages only in opted-in groups, uses content only for structured
  entry extraction, and documents retention in the group consent message.
- Latency: responder prompt within five seconds of a qualifying message.
- Reliability: list availability target of 99.5% during the pilot.
- Accessibility: every interaction has a plain text fallback.
- Opt-out: any member can mute bot prompts without leaving the group.

## 6. Metrics

North Star: **Resolved Asks**, chosen over daily actives or message volume because activity
metrics would reward engagement even if information decay remained unsolved.

| Type       | Metric                                                          | Pilot target          |
| ---------- | --------------------------------------------------------------- | --------------------- |
| Engagement | Recommendation-style messages captured as structured entries    | 50% or more           |
| Retention  | Median list queries per active group per week, week 4 vs week 1 | 1.5x growth or more   |
| Quality    | Entries flagged outdated or incorrect within 30 days            | 10% or less           |
| Growth     | New entries from members who joined after launch                | 20% or more by week 8 |

Guardrails: bot-mute or opt-out rate stays at or below 8%, and flagged-entry rate is monitored
so structured entries never degrade trust relative to organic recommendations.

## 7. Rollout

| Phase                       | Timing         | Scope                                               | Exit criteria                                            |
| --------------------------- | -------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Phase 0, manual validation  | Weeks 1 to 2   | Manually curated pinned list in one society, no bot | Three or more organic re-consultations observed          |
| Phase 1, pilot bot          | Weeks 3 to 8   | Core loop in 3 to 5 opted-in societies              | North Star and supporting targets met                    |
| Phase 2, hardening          | Weeks 9 to 12  | Moderation and admin controls, quality fixes        | Flagged entries at or below 10%, opt-outs at or below 8% |
| Phase 3, expansion decision | Week 13 onward | Cross-society, category, or dashboard evaluation    | Data-backed go or no-go                                  |

## 8. Risks

- WhatsApp platform policy or pricing changes: track platform updates and keep the data model
  portable to a fallback channel.
- Prompts perceived as spam: confidence thresholds on intent detection, strict opt-in, easy
  mute, capped prompt frequency.
- Stale or low-quality entries: admin flagging, staleness indicators, community flagging.

## 9. Copy rules for this website

- Never claim payments, bookings, a mobile app, or cross-society aggregation.
- Never publish invented statistics, testimonials, user counts, or logos.
- Keep the promise concrete: WhatsApp native, community owned, human vouched, no ads.
- Use plain punctuation. No em dashes, no typographic ellipses, complete sentences only.
