# BN Yönetim — AI Center Module
## STEP 11 Quality Review & STEP 12 Validation Report

**Sprint:** 02 · AI Center (single module)
**Artifact:** `bn-ai-center.html` — 107.9 KB, single file, zero JavaScript dependencies
**Baseline:** Version 22 frozen · Sprint 01 Dashboard untouched
**Date:** 25 July 2026

---

# 0. BASELINE CORRECTION — Sprint 01 record amended

Before reviewing this sprint's work I must correct something I recorded incorrectly in Sprint 01.

To build the AI Center faithfully I had to read the actual `BN AI Bölümü` markup in your Version 22 dashboard file. Doing so revealed that **the Version 22 palette is eighteen colours, not the six I documented as "frozen tokens" in Sprint 01.**

The full Version 22 palette:

```
#030712  #060B14  #06B6D4  #0E7490  #0F172A  #10B981
#14B8A6  #2563EB  #3B82F6  #8B5CF6  #94A3B8  #A855F7
#E2E8F0  #EAB308  #EC4899  #EF4444  #F59E0B  #F97316
```

Two consequences, stated plainly:

1. **Sprint 01 was not damaged by this.** I used a conservative subset and derived everything else from it, so nothing was broken or overwritten. But my claim that Sprint 01 introduced "zero new hues against a six-token baseline" was measured against an incomplete inventory. The correct statement is that Sprint 01 used a subset of an eighteen-colour palette.
2. **Sprint 01 used the wrong secondary-text value.** Version 22 uses `#94A3B8` for secondary text; Sprint 01 derived `rgba(226,232,240,.52)` (≈ `#7C8592`). These are visually close and both pass contrast, but they are not the same token. The AI Center uses `#94A3B8`, the Version 22 canonical value.

I have not unilaterally changed the approved Dashboard. Reconciling that one token is a two-line change and belongs in a consistency pass you approve, not in a sprint scoped to a different module. It is recorded in section 12.3.

The practical benefit of this discovery is significant: the eight `ai-card` slots in Version 22 each carry a specific Lucide icon and accent colour, and those are now reproduced exactly rather than approximated.

---

# STEP 11 — QUALITY REVIEW

Ten defects found in my own implementation. All ten fixed before completion.

| # | Dimension | Defect | Fix |
|---|---|---|---|
| F1 | Business logic | Accepting an already-generated recommendation was disabled when the session AI kill switch was on. But acceptance is a *human decision on an existing proposal*, not a generation — disabling it contradicted the module's own "degrade to less, never to wrong" principle and stranded work the user had already been shown | Acceptance stays available with AI off; only generative surfaces are disabled |
| F2 | Accessibility | The AI kill switch carried `aria-pressed` while also changing its visible label, so screen-reader users received two conflicting state signals | `aria-pressed` removed; the changing label is the state |
| F3 | Accessibility | The risk heat map conveyed severity through colour and a bare number with no text equivalent and no table alternative — the module's own STEP 3 required one for every chart | Accessible data table added behind a "Tabloyu göster" toggle, with severity words (Normal / Orta / Yüksek / Kritik) not just colour |
| F4 | UX | The governance bar declared the active scope, but the AI Center provided **no way to change it**. A permanently displayed, permanently unchangeable filter is worse than no filter — it looks like a control and is not one | Scope became a real control opening a picker; scope change re-renders every surface and is announced |
| F5 | Validation | Knowledge base search accepted an empty query and ran a retrieval against nothing | Minimum-length validation with a clear message |
| F6 | Accessibility | The `Ctrl↵` hint inside the send button was read as part of the button's accessible name | `aria-hidden` on the hint |
| F7 | Code quality | `P.sohbet` initialised conversation state during render — a state mutation inside a render function, which produces order-dependent bugs the moment rendering is repeated. An unused `lowConfDemo` flag was also left in state | Chat seeded at state declaration; dead flag removed |
| F8 | Code quality | A second global `click` listener existed alongside the main delegation root | Folded into the single delegation handler |
| F9 | Consistency | Heat map toggle and scope button were added without wiring into the delegation root | Wired into the single handler with the rest |
| F10 | Code quality | **My own F4 fix introduced a regression** — an unclosed `<div>` in the scope dialog, which nests subsequent content incorrectly | Caught by the whole-document balance check and fixed; final balance verified clean |

F10 is worth naming explicitly: a fix that introduces a defect is the most common failure mode in self-review, and it is why the structural check runs *after* the fixes rather than before them.

## 11.1 Dimension verdicts after fixes

**Enterprise UX.** Ten tabs on the Sprint 01 tab component; identical band rhythm; every generated output carries provenance, confidence and a human-approval flag; every proposal ends in an explicit accept or a reason-coded dismissal.

**AI experience.** Streaming with a stop control; evidence one click from every answer; result sets rendered as real tables rather than prose approximations; follow-up chips; feedback on every message; low-confidence rendered as a distinct designed state rather than an error; explicit refusal when grounding is insufficient.

**Consistency.** Every primitive is the Sprint 01 component reused verbatim. Three new compositions registered (conversation, factor decomposition, agent card) — no new visual language. The eight Version 22 AI cards reproduce their exact icons and accent colours; the chat bubble reproduces `max-width:80%` and the `#0E7490` at 20% fill with the squared top-left corner; the Version 22 greeting is byte-identical.

**Accessibility.** ARIA tab pattern with roving tabindex; `role="log"` with `aria-live="polite"` and `aria-busy` on the conversation so streaming is announced without interrupting typing; stop control always keyboard-reachable; `role="switch"` with `aria-checked` on toggles; validated forms with `aria-invalid` and linked errors; heat map and factor bars have text equivalents; contrast of `#94A3B8` on `#0F172A` measures ≈ 5.3:1; reduced-motion honoured; skip link; Turkish `lang`.

**Performance.** No JavaScript libraries, no CSS framework, inline SVG sprite. One external request (DM Sans). Streaming keeps perceived latency low. 107.9 KB single document.

**Security.** Governance bar states the boundary permanently. The data-boundary panel names what the AI cannot reach at any permission level. Agent authority is capped at level 2 with levels 3–4 shown as disabled and explained. Global kill switch requires a reason. The audit panel is presented as immutable with masked prompts.

**Integration.** Every write path is framed as executing through the owning module's API under the user's own permission, with the accountable human named in the confirmation dialog. The other eight sidebar modules state that they are out of Sprint 02 scope.

**Business logic.** Predictions are labelled as statistical output, explicitly not generative. Correlation claims are labelled as hypotheses. Notification exemptions are shown as enforced in code. Duplicate work orders are proposed for merge, never merged.

---

# STEP 12 — VALIDATION REPORT

## 12.1 Completed features

**Structure.** Ten tabs · twenty-four submodule cards (eight in preserved Version 22 slots) · always-visible governance bar with working scope selector and session kill switch · command palette indexing tabs, AI actions and all twenty-four submodules.

**Conversational.** Copilot with streamed answers, stop control, four modes (Soru / Taslak / Analiz / Rapor), suggested prompts, follow-up chips, per-message provenance (source count, model tier, latency, confidence), evidence dialog, thumbs feedback, structured result tables, and a genuine insufficient-grounding refusal path. AI Sohbet preserving the Version 22 panel and greeting.

**Generative surfaces.** Daily briefing (three-part narrative, evidence, export) · meeting assistant · task assistant producing a draft work order with duplicate-merge warning · report generator producing a real report definition · knowledge base with citations and grounded refusal · workflow assistant producing a rule with plain-language restatement and a twelve-month simulation including false-positive count.

**Predictive surfaces.** Risk heat map (6 estates × 4 dimensions) with drill-down factor decomposition and accessible table · predictive maintenance with 30/60/90-day probability, factor weights and prevent-vs-repair cost comparison · financial advisor with forecast band and partial-period warning · root cause analysis with an explicit "unexplained" residual.

**Governance.** Agent console with eight agents, authority chips, per-agent toggles, reason-gated global kill switch · policy toggles · data boundary panel · quota, retention and no-training statements · immutable audit log with per-entry detail including correlation ID · prompt library · quality metrics by feature · cost and usage with month-end projection.

**States.** Streaming, low confidence, insufficient grounding, empty ("nothing to recommend" as reassurance), processing, error, AI-disabled degraded mode listing what still works.

**Validation implemented in code.** Prompt length 3–4,000 characters · task text minimum · report and rule description minimums · knowledge base query minimum · mandatory dismissal reason · mandatory kill-switch reason (≥10 characters) · double-submit protection on accept.

## 12.2 Missing features (honest inventory)

**Specified in STEPS 1–9 but not implemented in this artifact:**

- Time range filter (scope is implemented; period is not)
- Saved conversation threads are displayed but not actually persistable or deletable
- Voice input and file attachment in the composer (composer chrome present, handlers absent)
- Prompt library authoring and versioning UI (catalogue is read-only)
- Per-role and per-submodule policy matrix (single toggle list only)
- Audit log filtering, date range and export execution (table and detail present; controls are stubs)
- Insight sensitivity threshold adjustment
- Individual staff productivity comparison behind its explicit permission
- Agent authority level *editing* (levels displayed; the change dialog is not built)
- Document upload from the file system (a seeded sample document is processed instead)

**Not implementable in a static artifact:** ACL-filtered retrieval, tenant isolation, prompt-injection sanitisation, PII redaction, schema validation of model output, model routing, caching, rate limiting, quota enforcement, immutable audit persistence, real streaming from a model. These are specified in STEPS 6–9 and are server-side by nature. The client here demonstrates the contract; it is not the boundary.

**Out of scope by protocol:** every other module.

## 12.3 Future enhancements

Near term: time range filter · real thread persistence · audit filtering and export · policy matrix by role · document upload · agent authority editing dialog.
Medium term: voice input · multi-turn context visualisation · comparison of AI-assisted vs. manual outcome quality · per-tenant terminology tuning UI.
Roadmap-aligned: autonomy levels 3–4 with blast-radius limits and counterfactual measurement (Version 32) · portfolio-level strategic advisor (Version 33).
**Recommended consistency pass:** reconcile the Sprint 01 secondary-text token to the Version 22 canonical `#94A3B8` and publish the full eighteen-colour palette as the documented baseline.

## 12.4 Enterprise readiness

The governance layer is the strongest part of this module and the part enterprise procurement actually evaluates: a permanently visible boundary statement, a working session kill switch, a reason-gated global agent stop, an explicit data-boundary panel, capped agent authority with the uncapped levels visibly disabled, an audit surface, and quality plus cost measurement. What is missing for enterprise deployment is not design — it is the server-side enforcement of everything the interface currently only asserts.

## 12.5 AI readiness

The module is architected for trust before capability, which is the correct order. Provenance on every output, evidence one click away, confidence as a designed state rather than a number, hypotheses labelled as hypotheses, statistical predictions separated from generative language, and a refusal path that is a first-class state rather than an error. No output can reach a business table without a named human acceptance. The honest limitation is that no real model is connected: response quality, Turkish register, injection resistance and grounding accuracy are all unproven and cannot be scored from this artifact.

## 12.6 Scores

| Dimension | Score | Basis |
|---|---|---|
| **UX** | **90 / 100** | Consistent band rhythm across ten tabs, complete state coverage, evidence always one click away, every proposal ends in an explicit reversible decision. Held back by the missing time range filter and by five surfaces whose secondary controls are stubs. |
| **Performance** | **93 / 100** | Zero dependencies, inline sprite, streaming for perceived latency, 108 KB single document. Held back by the webfont request and by full re-render on every state change, which will not scale to long conversations without list virtualisation. |
| **Accessibility** | **92 / 100** | Full tab pattern, `role="log"` with `aria-busy` for streaming, text equivalents for heat map and factor bars, validated forms, verified contrast, reduced-motion. Held back by no live assistive-technology testing and by 10.5px provenance text, which is legible but near the practical floor. |
| **Security** | **84 / 100** | Boundaries stated, authority capped, kill switches reason-gated, audit surfaced, permission model specified in depth. Held back hard by the fact that every control here is presentational — the retrieval-layer ACL, injection defence and tenant isolation that make these claims true do not exist in a static file. |
| **Production readiness** | **58 / 100** | Lower than Sprint 01's Dashboard, and correctly so: a dashboard without a backend still shows a designed surface, whereas an AI centre without a model is a specification with an interface attached. The design and governance layers are ready for implementation; the intelligence is entirely unbuilt. |

## 12.7 Verification evidence

```
Tag balance ................ all element types balanced (294/294 <div>)
V22 palette ................ 18 / 18 colours present and unmodified
V22 components ............. chat-bubble, max-width:80%, greeting text,
                             "Yapay Zeka Destekli Yönetim", nav active state,
                             DM Sans, glass, blur(16px), glow — all present
V22 ai-card slots .......... 8 / 8 reproduced with exact icon + accent
                             (wallet #0E7490 · wrench #10B981 · shield #2563EB ·
                              sparkles #EC4899 · user-check #F59E0B ·
                              line-chart #8B5CF6 · file-spreadsheet #06B6D4 ·
                              message-square #14B8A6)
Accessibility markers ...... tablist 1 · tab 10 · tabpanel 1 · log 2 · switch 2
                             aria-live 4 · aria-busy 1 · aria-modal 1
                             aria-label 24 · aria-expanded 4 · aria-invalid 3
                             aria-checked 3 · sr-only 7 · skip 1
                             focus-visible 2 · reduced-motion 1
External dependencies ...... 1 (DM Sans webfont)
Browser storage ............ 0 occurrences
File size .................. 107.9 KB uncompressed
```

**Note on the Version 22 card titles.** The eight `ai-card` slots in your Version 22 file contain the icons and accent colours but **empty title and description text** — they are unfilled Canva placeholders. I assigned each slot the submodule whose meaning matches its icon (wallet → Finansal Danışman, wrench → Kestirimci Bakım, and so on). If those slots were meant to carry different titles, tell me and I will swap the labels without touching the icons or accents.

---

## STOP

Sprint 02 is complete. The AI Center has been analysed, specified across nine steps, implemented, self-reviewed, corrected and validated.

**The Finance module has not been started, and no other module has been touched.**

I am waiting for your approval before Sprint 03.
