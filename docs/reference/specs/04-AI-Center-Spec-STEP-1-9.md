# BN Yönetim — AI Center Module
## Sprint 02 · Enterprise Implementation Specification (STEP 1 – STEP 9)

**Module:** AI Center (only)
**Baseline:** Version 22 frozen · Sprint 01 Dashboard approved and untouched
**Mode:** Extension. No redesign of platform, navigation, design system or component library.
**Governing principle:** *The AI Center assists; it does not replace.* Every capability in this module ends in a human decision, and the module is architected so that removing the AI entirely would degrade convenience but never break operations.

---

# STEP 1 — MODULE ANALYSIS

## 1.1 Purpose of the AI Center

The AI Center is the platform's **intelligence hub**: the single place where every AI capability in BN Yönetim is surfaced, governed, audited and controlled. It exists for three reasons that a scattered set of AI features cannot satisfy:

1. **Coherence.** Without a hub, AI appears as a chat box here, a suggestion chip there, and a summary somewhere else, each with different behaviour, different trust properties and different data access. The AI Center gives one behavioural contract to every AI surface in the product.
2. **Governance.** Enterprise buyers do not ask *can your AI do this*; they ask *what does it read, who approved it, what did it do, and how do I stop it*. Those four questions need an address in the product. This module is that address.
3. **Trust accumulation.** AI adoption is not a feature problem, it is a confidence problem. The AI Center is designed so that every output carries provenance, confidence and a reversible human decision — which is how an organisation earns its way toward the autonomy that Version 32 will eventually offer.

**What the AI Center is not.** It is not a replacement for the Dashboard (which triages), not a replacement for the operational modules (which own business logic), and not an autonomous operator. In Sprint 02 the AI proposes, drafts, ranks, explains and predicts. A human always decides.

## 1.2 Primary users

| Role | Turkish label | Primary AI need | Default landing |
|---|---|---|---|
| Estate Manager | Site Yöneticisi | Daily briefing, drafting, "what should I do first" | Günlük Brifing |
| Portfolio Manager | Portföy Yöneticisi | Cross-estate comparison, exception explanation | AI Panosu |
| Finance / Accounting | Muhasebe & Finans | Collection forecasting, cost anomalies, budget drafting | Finansal Danışman |
| Technical Lead | Teknik Şef | Failure prediction, root-cause analysis, job briefs | Kestirimci Bakım |
| Executive | Üst Yönetim | Executive summary, portfolio narrative, scenario questions | Günlük Brifing |
| Auditor | Denetçi | What the AI read, produced and influenced | AI Denetim Kaydı |
| System Administrator | Sistem Yöneticisi | Enablement, quotas, data boundaries, quality | AI Ayarları |
| Support / Front Desk | Danışma | Knowledge base answers, procedure lookup | Bilgi Bankası |

**Not a user:** residents. Resident-facing AI belongs to the Resident Portal (V29) and is governed separately, with a hard data boundary. The AI Center is a staff and governance surface.

## 1.3 Daily usage scenarios

**07:00 — Executive, phone.** Opens Günlük Brifing. Reads a three-paragraph portfolio narrative generated at 06:00: what moved, what needs attention, what is trending. Taps one figure, sees the evidence records behind it, forwards the briefing to the board.

**08:30 — Estate Manager.** Asks the Copilot: *"Yıldız Sitesi'nde bu ay kaç acil iş emri açıldı ve kaçı SLA'yı aştı?"* Receives a live, filterable, exportable result set — not a paragraph. Clicks through to two breaching records and reassigns them.

**10:00 — Technical Lead.** Opens Kestirimci Bakım. Sees five assets ranked by 60-day failure probability with the contributing factors decomposed. Accepts one recommendation, which drafts a preventive work order for human confirmation.

**14:00 — Finance.** Uploads a contractor invoice to Belge Asistanı. Parties, amount, VAT, period and obligations are extracted and matched against the open work order; a price deviation against the portfolio benchmark is flagged. Finance corrects one extracted field and approves.

**16:00 — Estate Manager.** Types *"asansör bakımı nedeniyle B Blok'ta yarın 09:00–12:00 arası kesinti olacağını duyur"* into the Copilot. Receives a drafted announcement in correct formal Turkish, edits one sentence, and sends it — through the Communication module's own API, with its own audit trail.

**Weekly — Administrator.** Reviews the AI quality dashboard: acceptance rate, override rate, dismissal reasons, cost per role. Tightens the confidence threshold on one insight category that is producing noise.

## 1.4 Integration with every platform module

The AI Center **reads widely and writes narrowly**. It has read access, within the requesting user's permission scope, to every module; it has write access to nothing except its own records. Every action it takes in another module goes through that module's public API and inherits that module's validation, permissions and audit.

| Module | AI Center reads | AI Center may propose |
|---|---|---|
| Dashboard | KPI history, alerts, layout context | Insight cards surfaced on the Dashboard's AI band |
| Görevler / İş Emirleri | Work orders, categories, SLA, history | Drafted work order · priority suggestion · reassignment |
| Takvim | Events, statutory deadlines | Scheduling suggestion |
| Bildirimler | Delivery, read state, categories | Notification ranking · digest composition |
| Site Haritası | Estate, block, unit topology | Location inference from free text |
| Grafikler | Chart definitions | Chart selection for generated reports |
| Kartlar / Widgetlar | Widget catalogue | Widget suggestion for a role |
| Finans (V28) | Charges, payments, arrears, budget | Collection forecast · budget draft · anomaly flag |
| Demirbaş & Bakım (V27) | Assets, service history, failures | Failure prediction · maintenance interval |
| Personel | Aggregate attendance, workload | Workload rebalancing suggestion |
| Sakin Talepleri (V29) | Requests, comments, surveys | Classification · routing · sentiment · draft reply |
| İş Akışı (V24) | Process definitions, approvals | Drafted automation rule for human review |
| Raporlar | Report catalogue, schedules | Report definition from natural language |

**The hard boundary.** The AI Center never reads: personnel special-category data (health-related absence reason, disciplinary records), raw CCTV or access-control movement data, or resident data outside the requesting user's scope. This is enforced at the retrieval layer, not by prompt instruction — an instruction is a request, a retrieval filter is a control.

## 1.5 Business value

- **Reporting labour collapses.** The days a yönetici spends assembling monthly and board reporting compress into review-and-approve.
- **Time-to-notice falls.** Predictive alerts move problems from discovery to anticipation; in this domain that is the difference between a scheduled service and an emergency call-out premium.
- **New staff become productive faster.** Natural-language access removes the need to learn a report catalogue or a filter syntax before being useful.
- **Written quality rises uniformly.** Announcements, contractor briefs and resident replies acquire consistent, correct formal Turkish regardless of who drafts them.
- **The brand promise is paid off.** The Version 22 marketing site already sells an AI-powered platform and a testimonial already claims a 30% maintenance-cost reduction. This module makes that a defensible product capability rather than a claim.

## 1.6 Enterprise architecture role

The AI Center sits as a **governed intelligence layer between the data platform and the user-facing modules**. It owns no business truth. It has four architectural responsibilities:

```
   Modules (owners of business truth)
        │  read-only, permission-scoped
        ▼
   ┌──────────────────────────────────────────────┐
   │  AI CENTER                                    │
   │  1. Retrieval    — what the model may see     │
   │  2. Reasoning    — routing, ranking, drafting │
   │  3. Governance   — permission, cost, quality  │
   │  4. Provenance   — evidence, audit, feedback  │
   └──────────────────────────────────────────────┘
        │  proposals only, via each module's public API
        ▼
   Human decision → owning module executes and audits
```

This shape is deliberate: it means the AI can be disabled entirely — per tenant, per role, per submodule — and the platform continues to function exactly as it did in Version 22.

---

# STEP 2 — SUBMODULE DESIGN

Twenty-four submodules. The eighteen required, plus six that enterprise operation makes necessary (marked ✚). Each specifies Purpose, Users, Inputs, Outputs, Permissions and Business Value.

In the interface these are reached two ways, both preserving Version 22: the **AI Panosu card grid** (the frozen V22 eight-card "BN AI Bölümü" layout, extended) and a **ten-tab strip** using the identical tab component approved in Sprint 01.

---

### 2.1 AI Dashboard / AI Panosu
**Purpose.** Landing surface and index for the whole module; health and adoption of the AI itself.
**Users.** All.
**Inputs.** Usage telemetry, acceptance rates, cost, active agent states, submodule catalogue.
**Outputs.** AI KPI band (queries today, acceptance rate, hours saved, accuracy, cost, human-approval rate), the 24-card submodule grid, recent AI activity.
**Permissions.** `ai.view`.
**Business value.** Makes the value and the cost of AI legible in the same place, which is what keeps an AI programme funded.

### 2.2 AI Copilot / BN Copilot
**Purpose.** The primary conversational surface: natural-language questions answered with live, drillable result sets rather than prose.
**Users.** All operational roles.
**Inputs.** Question, current scope and time range, role, conversation history.
**Outputs.** Answer + structured result set + evidence record links + suggested follow-ups + optional action proposal.
**Permissions.** `ai.copilot.use`; results filtered to the user's data scope.
**Business value.** Removes the query-syntax and report-catalogue barrier between a question and its answer.

### 2.3 AI Chat / AI Sohbet
**Purpose.** The Version 22 conversational panel, preserved exactly and given persistence, history and provenance.
**Users.** All.
**Inputs.** Free-text message.
**Outputs.** Threaded conversation with the frozen V22 bubble styling and the frozen greeting.
**Permissions.** `ai.chat.use`.
**Business value.** The familiar entry point stays where users already know it while gaining enterprise properties.

### 2.4 AI Task Assistant / Görev Asistanı
**Purpose.** Turns intent into a properly formed work item.
**Users.** Estate managers, technical leads, front desk.
**Inputs.** Free text, photo, voice transcript, an existing request.
**Outputs.** Drafted work order with inferred category, priority, location, asset link and assignee suggestion — always as a draft.
**Permissions.** `ai.task.assist`; creation requires `workorder.create` in the owning module.
**Business value.** Removes the most repeated data-entry task in the operation and raises record quality at the point of capture.

### 2.5 AI Daily Briefing / Günlük Brifing
**Purpose.** A generated situational narrative, role-adapted, produced at 06:00 and on demand.
**Users.** Managers and executives.
**Inputs.** Overnight events, KPI movement, deadlines, open exceptions.
**Outputs.** Three-part narrative (what happened · what needs attention · what is trending) with source counts and evidence links; exportable.
**Permissions.** `ai.briefing.view`.
**Business value.** Replaces the fifteen to twenty minutes each manager spends reconstructing the overnight picture.

### 2.6 AI Recommendations / AI Önerileri
**Purpose.** Ranked, actionable proposals with quantified impact.
**Users.** All operational roles.
**Inputs.** Cross-module state, historical outcomes, portfolio benchmarks.
**Outputs.** Recommendation cards: finding, impact, confidence, evidence, recommended action, accept / dismiss with reason.
**Permissions.** `ai.recommendation.view`; acting requires the target module's permission.
**Business value.** Converts analysis into a decision queue rather than a reading exercise.

### 2.7 AI Insights / AI İçgörüleri
**Purpose.** Observations the user did not think to ask for — anomalies, correlations, emerging patterns.
**Users.** Managers, executives, analysts.
**Inputs.** KPI time series, event streams, text corpora.
**Outputs.** Insight cards with statistical basis stated and hypotheses labelled as hypotheses.
**Permissions.** `ai.insight.view`.
**Business value.** Surfaces slow-moving problems before they become fast-moving ones.

### 2.8 AI Analytics / AI Analitik
**Purpose.** Analysis of the AI itself: quality, adoption, cost, drift.
**Users.** Administrators, executives.
**Inputs.** Interaction logs, feedback, overrides, model telemetry.
**Outputs.** Acceptance and override rates by feature and role, latency, cost per interaction, drift indicators, dismissal-reason themes.
**Permissions.** `ai.analytics.view`.
**Business value.** An AI programme without measurement becomes an unfalsifiable expense.

### 2.9 AI Risk Detection / Risk Tespiti
**Purpose.** Continuous scan across financial, operational, compliance and satisfaction dimensions.
**Users.** Managers, executives, auditors.
**Inputs.** Cross-module signals, thresholds, portfolio norms.
**Outputs.** Per-estate risk score with weighted contributing factors, portfolio heat map, trend, mitigation suggestions.
**Permissions.** `ai.risk.view`.
**Business value.** A decomposed risk score is acted upon; an opaque one is ignored.

### 2.10 AI Predictive Maintenance / Kestirimci Bakım
**Purpose.** Failure probability and optimal intervention timing per asset.
**Users.** Technical leads, portfolio managers.
**Inputs.** Asset age, service history, breakdown frequency, comparable assets, usage proxies.
**Outputs.** Ranked asset risk list with 30/60/90-day probabilities, factor decomposition, prevent-vs-repair cost comparison, drafted work order.
**Permissions.** `ai.maintenance.view`.
**Business value.** Emergency call-out premiums are the most expensive money in facilities management; this is the module that reduces them.

### 2.11 AI Financial Advisor / Finansal Danışman
**Purpose.** Collection forecasting, cost anomaly detection, budget drafting.
**Users.** Finance, executives, auditors (read-only).
**Inputs.** Charges, payments, arrears ageing, expense lines, contracts, asset replacement schedule.
**Outputs.** Collection forecast with confidence band, payment-behaviour segments, cost outliers vs. portfolio peers, draft işletme projesi.
**Permissions.** `ai.finance.view`; unit-level debtor identity additionally requires `finance.debtor.view`.
**Business value.** Collection rate is the highest-leverage metric in the domain; targeted intervention beats uniform pressure.

### 2.12 AI Document Assistant / Belge Asistanı
**Purpose.** Reads the documents this domain drowns in.
**Users.** Finance, managers, auditors.
**Inputs.** Contractor invoices, contracts, meeting minutes, inspection reports, correspondence.
**Outputs.** Extracted parties, amounts, dates, obligations, renewal and penalty clauses; filing against the right estate; matching against work orders; deviation flags. Every extracted field is editable before acceptance.
**Permissions.** `ai.document.use`.
**Business value.** Obligation and renewal dates stop living in someone's memory.

### 2.13 AI Report Generator / Rapor Üretici
**Purpose.** Natural language to a real, saveable, schedulable report definition.
**Users.** Managers, finance, executives.
**Inputs.** Description in Turkish, scope, period.
**Outputs.** Report definition object (metrics, dimensions, filters, chart types) plus a preview and a narrative; saved into the Reports module catalogue.
**Permissions.** `ai.report.generate`; distribution requires `report.share`.
**Business value.** The board pack stops being a manual assembly job.

### 2.14 AI Knowledge Base / Bilgi Bankası
**Purpose.** Answers about procedure, regulation and house rules, grounded in the tenant's own documents.
**Users.** All staff, especially new and front-desk.
**Inputs.** Yönetim planı, house rules, SOPs, statutory references, prior resolutions.
**Outputs.** Grounded answer with citations to the source document and clause; explicit "bulunamadı" when unsupported.
**Permissions.** `ai.kb.use`.
**Business value.** Institutional knowledge stops walking out the door with experienced staff.

### 2.15 AI Workflow Assistant / İş Akışı Asistanı
**Purpose.** Describe a desired behaviour in Turkish; receive a structured automation rule for human review.
**Users.** Managers, administrators.
**Inputs.** Natural-language rule description; existing process definitions.
**Outputs.** Draft rule (trigger → condition → action), a plain-language restatement for verification, and a simulation against the last twelve months showing what it *would have* done.
**Permissions.** `ai.workflow.assist`; activation requires `automation.rule.activate`.
**Business value.** Automation authorship stops being an engineering dependency.

### 2.16 AI Notification Intelligence / Bildirim Zekası
**Purpose.** Rank, batch and time notifications by learned relevance.
**Users.** All.
**Inputs.** Notification history, open and action rates, role, quiet hours.
**Outputs.** Ranked stream, digest composition, timing suggestions.
**Permissions.** `ai.notification.tune`.
**Business value.** Notification fatigue is the mechanism by which important alerts get ignored.
**Hard exemption.** Severity-1 alerts, statutory deadlines and financial threshold breaches are exempt from all learning-based filtering. A silenced critical alert is the worst failure this system can produce, so the exemption is enforced in code, not policy.

### 2.17 AI Automation Center / AI Otomasyon Merkezi
**Purpose.** Console for every AI-assisted automated behaviour, with explicit authority levels.
**Users.** Administrators, managers.
**Inputs.** Agent definitions, scopes, limits, execution history.
**Outputs.** Agent list with authority level, scope, spend cap, supervisor, activity, accuracy, and per-agent plus global kill switches.
**Permissions.** `ai.automation.view`; changing authority requires `ai.automation.manage`.
**Business value.** Autonomy is only sellable to an enterprise if it is visibly bounded and instantly stoppable.
**Sprint 02 constraint.** Every agent ships at authority level 1 (*suggest only*) or 2 (*draft and hold*). Levels 3 and 4 exist in the model and in the UI as disabled options with an explanatory note, because they belong to Version 32 governance.

### 2.18 AI Settings / AI Ayarları
**Purpose.** Governance console for the whole module.
**Users.** Administrators.
**Inputs.** Tenant policy, role mappings, data boundaries, quotas, model preferences.
**Outputs.** Per-submodule and per-role enablement, data boundary configuration, quota and cost caps, tone and terminology instructions, retention, no-training guarantee, fallback behaviour.
**Permissions.** `ai.settings.manage`.
**Business value.** Procurement asks these questions before signing; the answers must be demonstrable in-product.

### ✚ 2.19 AI Audit Log / AI Denetim Kaydı
**Purpose.** Immutable record of every AI interaction: who asked, what was retrieved, what was produced, what a human did with it.
**Users.** Auditors, administrators, security.
**Outputs.** Filterable, exportable log with correlation IDs and data-access detail.
**Permissions.** `ai.audit.view`.
**Business value.** Without this the module is unauditable, and an unauditable AI cannot be deployed against financial or statutory processes.

### ✚ 2.20 AI Quality & Feedback / Kalite ve Geri Bildirim
**Purpose.** Close the loop between output and correction.
**Outputs.** Accuracy trend, thumbs up/down with reasons, override themes, per-feature quality gates, regression watchlist.
**Permissions.** `ai.quality.view`.
**Business value.** Quality that is not measured decays silently.

### ✚ 2.21 AI Prompt Library / Komut Kütüphanesi
**Purpose.** Curated, permissioned, versioned prompts for recurring domain tasks.
**Outputs.** Categorised prompt catalogue (aidat hatırlatma metni, genel kurul gündemi, tedarikçi brifingi, arıza bildirimi özeti), usage stats, tenant-authored additions.
**Permissions.** `ai.prompt.use`; authoring requires `ai.prompt.manage`.
**Business value.** Turns the best user's phrasing into everyone's default.

### ✚ 2.22 AI Cost & Usage / Maliyet ve Kullanım
**Purpose.** Unit economics made visible before they become a surprise.
**Outputs.** Cost per interaction, per feature, per role, per estate; quota consumption; model routing mix; projection to month end.
**Permissions.** `ai.cost.view`.
**Business value.** AI cost scales with usage, and usage scales with success — this is where that gets managed.

### ✚ 2.23 AI Meeting Assistant / Toplantı Asistanı
**Purpose.** Board and owners' assembly support.
**Outputs.** Agenda draft, minute draft from notes or transcript, decision extraction into trackable tasks, resolution register.
**Permissions.** `ai.meeting.use`.
**Business value.** Genel kurul decisions become tracked commitments rather than paragraphs in a file.

### ✚ 2.24 AI Root Cause Analysis / Kök Neden Analizi
**Purpose.** Explain *why* a metric moved, not merely that it moved.
**Outputs.** Contribution decomposition, correlated events, comparable historical episodes, hypotheses explicitly labelled as such.
**Permissions.** `ai.rca.use`.
**Business value.** Prevents the most expensive management error in multi-site operations: treating a symptom that recurs.

---

# STEP 3 — SCREEN DESIGN

Every component below is drawn from the Sprint 01 component library. Three new compositions are registered; none is a new visual language.

## 3.1 Layout

The approved shell is unchanged: fixed 240px sidebar with the ten frozen navigation items, sticky header, `max-w` content region, 12-column grid, 16px gutter. The AI Center occupies the **BN AI Bölümü** and **AI Chat** sidebar positions, both of which already exist in Version 22.

```
┌────────────┬──────────────────────────────────────────────────┐
│  SIDEBAR   │  HEADER  title · date · search · bell · me       │
│  (frozen)  ├──────────────────────────────────────────────────┤
│            │  AI GOVERNANCE BAR  scope · model · human-review │
│            ├──────────────────────────────────────────────────┤
│            │  TABS  10 groups (scrollable)                    │
│            ├──────────────────────────────────────────────────┤
│            │  BAND 1  AI KPIs                                 │
│            │  BAND 2  primary surface (conversation / cards)  │
│            │  BAND 3  evidence · history · detail             │
└────────────┴──────────────────────────────────────────────────┘
```

The **AI governance bar** is new to this module and always visible: it states the active scope, that outputs require human approval, and offers a one-click "AI'yı bu oturumda devre dışı bırak". Making the off switch permanently visible is a trust decision, not a settings convenience.

## 3.2 Cards

**Submodule card** — the frozen Version 22 `ai-card` composition (icon · title · description), extended with a permission chip and an activity indicator. The eight original V22 cards remain the first eight entries with their titles preserved.

**Recommendation card** — gradient left accent (registered in Sprint 01 as `.ins`), category chip, confidence chip, finding, quantified impact, evidence link, accept / dismiss.

**Prediction card** — asset or subject, probability with a confidence band, factor decomposition bars, cost comparison, primary action.

**Agent card** — name, authority level chip, scope, spend cap, last run, accuracy, pause and stop controls.

## 3.3 Conversation panels

The Version 22 chat is preserved exactly: `.chat-bubble{max-width:80%}`, the same message geometry, and the frozen greeting *"Merhaba! Ben BN AI asistanınız. Size nasıl yardımcı olabilirim?"*

Extensions, all additive:
- **Streaming render** with a visible caret; the answer is readable as it arrives.
- **Provenance footer** on every assistant message: source count, records consulted, model tier, latency, and an "AI çıktısı — insan onayı gerektirir" label.
- **Result-set attachment** — when a question has a structured answer, the message carries a real table with drill-through, sort and export, not a prose approximation.
- **Follow-up chips** — two to four contextual next questions.
- **Feedback control** — thumbs up/down with reason capture on every assistant message.
- **Stop generation** control, always available during streaming.

## 3.4 Command panel

A dedicated composer above the conversation: scope selector, mode selector (Soru · Taslak · Analiz · Rapor), attachment, voice, and the send control. `Ctrl/⌘ + Enter` sends; `Ctrl/⌘ + K` opens the Sprint 01 command palette, which now also indexes AI actions.

## 3.5 Prompt suggestions

Three tiers, in this priority order: **role-based defaults** (what this role usually needs), **context-derived** (what the current scope and time range make relevant), and **library prompts** (curated, versioned). Suggestions never occupy more than one row and are dismissible.

## 3.6 Tables

Sprint 01 table component unchanged: sticky header, sortable, right-aligned tabular numerals, keyboard-navigable rows, export. Used for result sets, prediction lists, audit log, cost breakdown and quality metrics.

## 3.7 Charts

Sprint 01 chart grammar unchanged — bar for period comparison, line for trend, horizontal bar for ranked comparison, donut for share. New in this module: **confidence bands** rendered as a lighter fill from the frozen ramp, and **factor decomposition bars** showing weighted contribution. Every chart keeps the accessible data-table alternative.

## 3.8 Timeline

Used for the audit log, agent activity and document processing history: vertical rail, event dots coloured by the frozen semantic ramp, actor and timestamp, expandable detail. Composed from existing list primitives.

## 3.9 Search

Knowledge base search with grounded results: each hit shows the source document, the clause reference and a confidence chip, with the exact passage highlighted. When grounding is insufficient the module says so explicitly rather than generating an unsupported answer.

## 3.10 Filters

Scope (portfolio → estate), time range, submodule, confidence threshold, status (new / accepted / dismissed), and category. Active filters render as removable chips; no hidden filter state, consistent with Sprint 01.

## 3.11 Dialogs

Evidence dialog (records consulted) · accept-and-create dialog (shows exactly what will be written, where, and by whose authority) · dismiss-with-reason dialog · agent authority dialog · data-boundary dialog · export dialog · session-disable confirmation. All inherit the Sprint 01 dialog contract: focus trap, `Esc`, focus restore, `role="dialog"`, `aria-modal`.

## 3.12 Notifications

Toast conventions from Sprint 01. AI-specific additions: a persistent (non-auto-dismissing) toast when an AI action creates a record in another module, carrying the record reference and an undo; and an assertive announcement when a generation fails, because silent AI failure is indistinguishable from an empty answer.

## 3.13 States

**Loading.** Streaming caret for conversation; skeletons matching final geometry elsewhere. Long generations show a staged indicator (*bağlam toplanıyor → kayıtlar taranıyor → yanıt oluşturuluyor*) so the wait is legible rather than opaque.
**Empty.** Distinguished by cause: no history yet (offers starter prompts), no results for filter (offers reset), nothing to recommend (the good empty state — "Şu an öneri yok, portföy normal seyrediyor").
**Error.** Per-surface, never whole-module. Distinguishes: model unavailable · timeout · rate limit reached · insufficient grounding · permission denied. Each states cause and next action, with a correlation ID.
**Low confidence.** A distinct state, not an error: the answer renders with an explicit low-confidence banner and a recommendation to verify against the named source records.
**Degraded.** When the AI service is unavailable, the module renders a clear notice and every non-AI capability in the platform continues untouched — stated on screen, because users need to know the outage is bounded.

## 3.14 Responsive layout

| Breakpoint | Behaviour |
|---|---|
| ≥1440px | Conversation + evidence side panel side by side |
| 1024–1439px | Conversation full width; evidence in a dialog |
| 768–1023px | Sidebar collapses to the frozen V22 toggle; tabs scroll; cards two-up |
| 480–767px | Single column; composer docks to the bottom; suggestions become a horizontal scroll strip |
| <480px | Composer full width; result tables scroll horizontally within bounds; density forced to comfortable for touch |

## 3.15 Accessibility

Full ARIA tab pattern with roving tabindex (Sprint 01 contract). Conversation is a `log` with `aria-live="polite"` so streamed answers are announced without interrupting typing. `aria-busy` during generation. Stop-generation reachable by keyboard at all times. Every confidence and status chip carries a text equivalent, never colour alone. Factor bars and charts have table alternatives. Forms use `aria-invalid` with linked error text. Reduced-motion disables the streaming caret animation and bar transitions. Minimum 44px touch targets. Turkish `lang` attribute throughout.

---

# STEP 4 — AI WORKFLOW

## 4.1 User flow

```
Enter AI Center → governance bar states scope + human-approval requirement
 → choose surface (Copilot / Brifing / a specialised submodule)
 → ask, or review generated proposals
 → inspect evidence (always one click, never hidden)
 → decide: Accept | Edit and accept | Dismiss with reason | Ask follow-up
 → on accept: confirmation dialog states exactly what will be written and where
 → owning module executes → toast with record reference and undo
 → feedback captured → audit entry written
```

## 4.2 AI decision flow

```
Input → intent classification (question | draft | analysis | action proposal)
      → permission pre-check (may this user reach this data at all?)
      → scope resolution (which estates, which period)
      → model routing (cheap classifier → strong reasoner only when warranted)
      → retrieval (filtered corpus, never the whole tenant)
      → generation with evidence binding
      → confidence scoring
          ├─ high      → render with evidence
          ├─ medium    → render with verification prompt
          └─ low       → render low-confidence state, recommend source check
      → NEVER auto-execute in Sprint 02
```

## 4.3 Knowledge retrieval flow

```
Query → embed → hybrid search (vector + keyword) over the permitted corpus
      → row-level and document-level ACL filter applied BEFORE ranking
      → top-k passages with source, clause and recency
      → grounding sufficiency check
          ├─ sufficient   → generate with citations
          └─ insufficient → "Bu soruyu mevcut belgelerle yanıtlayamıyorum"
      → citations rendered as links to the source document and clause
```

The ACL filter runs before ranking, not after. Filtering after retrieval leaks the existence of inaccessible records through result counts and ranking behaviour.

## 4.4 Business rule flow

Business rules are read from the rule engine, never re-implemented in prompts. When the AI proposes something that violates a rule — an approval below threshold, a duplicate work order, a snooze on a statutory deadline — the proposal is blocked at generation time and the user is told which rule blocked it. The AI is a client of the rules, not an alternative to them.

## 4.5 Approval flow

```
AI proposes → human reviews (mandatory in Sprint 02)
  → if the action has financial or legal consequence:
       routed into the V24 approval workflow, with the AI's role recorded
       and the human approver named as the accountable party
  → segregation of duties applies to AI-assisted requests exactly as to manual ones
  → step-up authentication above threshold, unchanged
  → decision recorded with AI provenance: model, prompt version, confidence,
    evidence set — so a later audit can reconstruct what the human was shown
```

## 4.6 Notification flow

```
AI output requiring attention → classification → permission filter
  → relevance ranking (learned) → quiet hours and digest preference
  → EXEMPT: severity-1 alerts, statutory deadlines, financial thresholds
    (delivered immediately regardless of learned preference)
  → delivery → acknowledgement → feedback signal back into ranking
```

## 4.7 Audit flow

Every interaction writes an immutable entry: actor, timestamp, submodule, prompt (PII-redacted), intent classification, data sources touched, record IDs retrieved, model and version, token count, cost, confidence, output reference, human decision, resulting record if any, correlation ID. Retention follows the tenant's policy; entries are exportable for denetçi review and are never editable.

## 4.8 Human review flow

Three review depths, chosen by consequence rather than by convenience:

| Depth | Applies to | Requirement |
|---|---|---|
| **Light** | Read-only answers, summaries | Feedback control present; no gate |
| **Standard** | Drafts that will be sent or filed | Explicit accept; content editable before acceptance |
| **Deep** | Anything with financial, legal or resident-facing consequence | Accept + confirmation dialog naming the target module and the accountable human + approval workflow where thresholds apply |

Dismissals capture a reason. That reason is the module's most valuable training signal and its most honest quality metric.

---

# STEP 5 — AI CAPABILITIES

**5.1 AI Copilot.** Context-aware assistant present on every AI Center surface and available from the Dashboard. Knows the active scope, period, tab and role. Answers with structured result sets, drafts documents, explains metrics, and proposes actions. Multi-turn refinement without restating context. Never executes.

**5.2 Natural Language Commands.** Turkish command understanding mapped to a whitelisted action catalogue — create work order, publish announcement, generate report, schedule maintenance, run reminder. Each parsed command renders as a structured preview showing exactly what will happen, with every parameter editable, before any confirmation is possible.

**5.3 Daily Executive Summary.** Portfolio narrative generated at 06:00: what moved and by how much, which estates drove it, what needs a decision today, what is trending. Role-adapted, evidence-linked, exportable as a board-ready PDF.

**5.4 Task Prioritisation.** Ranks the user's open work by a transparent composite of SLA proximity, severity, resident impact, cost of delay and dependency. The weighting is visible and adjustable — an opaque priority score is not actionable.

**5.5 Risk Prediction.** Forward-looking scores across financial (collection shortfall, cash risk), operational (SLA breach, coverage gap), compliance (statutory deadline) and satisfaction (churn-risk estates) dimensions, each decomposed into weighted factors.

**5.6 Maintenance Prediction.** Per-asset failure probability at 30/60/90 days from age, service history, breakdown frequency, comparable assets and seasonality — with the prevent-versus-repair cost comparison that makes the recommendation a business case rather than a warning.

**5.7 Budget Suggestions.** Drafts next period's işletme projesi from actuals, contracted commitments, asset replacement schedules and inflation assumptions, with every assumption stated and adjustable, and a variance explanation for the current period.

**5.8 Resident Complaint Analysis.** Classifies, routes and clusters resident requests; identifies recurring themes; correlates complaint volume with operational metrics to show which service failure is actually generating the complaints.

**5.9 Sentiment Analysis.** Trend per estate from request text, comments and survey free-text, with theme decomposition. Reported at estate level; never used to score individual residents.

**5.10 Staff Productivity Analysis.** Completion rate, resolution time and first-time-fix by function, normalised for job complexity so difficult work is not penalised. Presented at team level by default; individual comparison requires an explicit permission and is itself audited, because productivity data is easily misused.

**5.11 Meeting Summary.** Agenda drafting, minute generation from notes or transcript, decision extraction into trackable tasks, and a resolution register for genel kurul and board meetings.

**5.12 Document Summarisation.** Contracts, invoices, inspection reports and correspondence reduced to parties, amounts, dates, obligations, penalties and renewal terms — every field editable and traceable to its location in the source document.

**5.13 Automatic Report Generation.** Natural language to a real report definition, editable afterwards in the standard report builder, saveable and schedulable, with an auto-written narrative.

**5.14 Smart Recommendations.** Cross-module proposals ranked by quantified impact × confidence: reactivate a dormant reminder ladder, rebalance a technician's queue, renegotiate a drifted supplier price, bring forward a maintenance interval.

**5.15 Workflow Suggestions.** Observes repeated manual sequences and proposes an automation rule, complete with a twelve-month simulation of what it would have done — so the user judges evidence, not a promise.

**5.16 Root Cause Analysis.** Decomposes a metric movement into contributing factors, correlates with events, finds comparable historical episodes, and labels causal claims as hypotheses requiring human judgement.

**5.17 Operational Health Score.** A composite index per estate across financial, technical, satisfaction and compliance dimensions, with fully transparent weighting and one-click decomposition. Transparency is the feature; the number alone would be worthless.

---

# STEP 6 — ENTERPRISE AI ARCHITECTURE

## 6.1 AI services

| Service | Responsibility |
|---|---|
| Intent Service | Classify input; route to capability; cheap model |
| Retrieval Service | ACL-filtered hybrid search; owns the permission boundary |
| Reasoning Service | Generation, drafting, explanation; model-tier routing |
| Prediction Service | Statistical and ML forecasting; no generative model involved |
| Evidence Service | Binds every output to source record IDs |
| Governance Service | Permission, quota, policy, kill switch |
| Audit Service | Immutable interaction log |
| Feedback Service | Ratings, overrides, dismissal reasons → quality metrics |

Prediction is deliberately separated from generation. Numbers come from statistical models; language comes from generative models. A generative model must never be the source of a forecast figure.

## 6.2 Agent responsibilities

| Agent | Does | Authority (Sprint 02) |
|---|---|---|
| Briefing Agent | Composes the daily narrative | 1 — suggest only |
| Insight Agent | Detects anomalies, ranks findings | 1 |
| Maintenance Agent | Scores asset failure risk, drafts work orders | 2 — draft and hold |
| Collection Agent | Segments payers, drafts reminder text | 2 |
| Document Agent | Extracts and matches document fields | 2 |
| Triage Agent | Classifies and routes incoming requests | 2 |
| Report Agent | Builds report definitions | 2 |
| Rule Agent | Drafts automation rules, simulates | 2 |

Levels 3 (*execute and notify*) and 4 (*execute silently*) exist in the data model and appear in the UI as disabled, explained options. They are Version 32 territory and are not enabled by this sprint under any configuration.

## 6.3 Knowledge sources

Tenant operational data (permission-scoped) · tenant documents (yönetim planı, contracts, minutes, SOPs) · platform product knowledge (how BN Yönetim works) · domain reference (Kat Mülkiyeti Kanunu, statutory inspection regimes, e-document obligations) · portfolio benchmarks (anonymised and aggregated; never another tenant's identifiable data).

## 6.4 Memory usage

**Session memory** — full conversation context, discarded at session end unless saved.
**Saved threads** — user-initiated, named, revisitable, deletable.
**Preference memory** — explicit and user-visible: preferred report formats, terminology, tone. Editable and clearable in one place.
**No implicit long-term memory.** The system does not silently accumulate a profile of the user. Anything remembered is visible and removable — a KVKK posture as much as a trust posture.

## 6.5 Permission model

Three layers, all enforced server-side:

1. **Feature permission** — may this user use this AI capability at all (`ai.copilot.use`).
2. **Data permission** — inherited entirely from the source modules; the AI can never see what the user cannot.
3. **Action permission** — accepting a proposal requires the target module's own permission, checked at execution.

The AI holds no independent identity or elevated access. Every retrieval executes as the requesting user. There is no service account with broader reach — which is the single most important architectural decision in this module.

## 6.6 Conversation context

Assembled per turn as: system policy (tenant tone, terminology, hard rules) + role and permission scope + active scope and period + last N turns within a token budget + retrieved evidence passages. Context assembly is logged so any answer can be reconstructed. Older turns are summarised rather than truncated, and the summarisation is itself visible in the audit entry.

## 6.7 Logging and audit trail

Two distinct streams. **Operational logging** (latency, tokens, errors, cache hits) is retained short-term for engineering. **Audit trail** (who, what, which records, what decision) is immutable, long-retention, exportable, and never contains raw PII — personal identifiers are redacted and replaced with record references.

## 6.8 LLM usage strategy

Tiered routing by task: a small fast model for classification, routing and extraction; a mid model for summarisation and drafting; a strong model only for multi-step analysis and cross-module reasoning. Turkish-first evaluation with a domain glossary (aidat, demirbaş, işletme projesi, kat malikleri kurulu, gecikme tazminatı, arsa payı) and correct formal register. Prompts are versioned artifacts with a rollback path. Structured outputs are schema-validated before rendering; a schema failure produces an error state, never a rendered guess.

## 6.9 Caching strategy

Embeddings cached and invalidated on source change · common portfolio queries pre-computed on a schedule · identical prompt with identical context within a short window served from cache and labelled as cached · prediction outputs cached to their refresh tier · negative results cached briefly to blunt repeated failing queries.

## 6.10 Fallback strategy

```
Strong model unavailable  → mid model, with a visible notice about reduced depth
All generative unavailable → deterministic surfaces still work:
                             predictions, saved reports, KPI figures, audit
Retrieval unavailable      → answer refused rather than generated ungrounded
Timeout                    → partial stream retained, resume offered
Rate limit                 → queued with countdown, manual retry available
Complete AI outage         → module states the outage plainly; the rest of the
                             platform is unaffected and says so
```

The rule underneath all of it: **degrade to less, never to wrong.**

## 6.11 Cost optimisation

Model routing by task complexity · aggressive caching · token budgets per request and per role · batch generation for scheduled work like briefings · pre-computation of predictable queries · per-tenant quotas with soft warnings before hard caps · cost visibility per feature so an expensive, low-acceptance capability can be identified and cut.

## 6.12 Security controls

Strict tenant isolation at the retrieval layer, covered by automated tests on every build · prompt-injection defences on all ingested documents and resident-submitted text, with retrieved content treated as data and never as instructions · PII redaction in prompts and logs · configurable no-training guarantee · output filtering to prevent leakage of records outside scope · rate limiting and anomaly detection on usage patterns · encrypted transport and storage · full audit of every data access.

---

# STEP 7 — DATA MODEL

## 7.1 Entities owned by the AI Center

**AISession** — `id · userId · tenantId · startedAt · endedAt · scope · surface · turnCount · totalTokens · totalCost · status`
**AIConversation** — `id · sessionId · title · isSaved · createdAt · lastMessageAt · pinnedRecords[]`
**AIMessage** — `id · conversationId · role(user|assistant|system) · content · intent · modelTier · promptVersion · tokensIn · tokensOut · latencyMs · confidence · isCached · evidenceRefs[] · feedback? · createdAt`
**AIPrompt** — `id · key · title · category · template · variables[] · version · requiredPermission · isTenantAuthored · usageCount · createdBy`
**AIRecommendation** — `id · agentKey · category · finding · impactValue · impactUnit · confidence · evidenceRefs[] · recommendedAction · targetModule · targetPayload · scopeType · scopeId · status · generatedAt · reviewedBy? · reviewedAt? · dismissReason? · resultingRecordRef?`
**AIPrediction** — `id · subjectType(asset|estate|unit|metric) · subjectId · predictionType · horizonDays · probability · confidenceLow · confidenceHigh · factors[{name,weight,value}] · modelVersion · computedAt · expiresAt`
**AIInsight** — `id · category · finding · statisticalBasis · isHypothesis · evidenceRefs[] · scopeId · status · generatedAt`
**AIDocument** — `id · fileRef · docType · estateId · extractedFields{} · confidencePerField{} · matchedRecordRef? · status(pending|reviewed|accepted|rejected) · reviewedBy? · corrections[]`
**AIAgent** — `key · name · description · authorityLevel(1–4) · isActive · scope · spendCapMonthly · supervisorUserId · lastRunAt · runCount · acceptanceRate · killSwitch`
**AIAgentRun** — `id · agentKey · startedAt · finishedAt · itemsProcessed · proposalsCreated · errors · cost · status`
**AIAuditEntry** — `id · correlationId · actorId · surface · action · promptRedacted · intent · dataSourcesTouched[] · recordIdsRetrieved[] · modelTier · promptVersion · tokens · cost · confidence · outputRef · humanDecision · resultingRecordRef? · occurredAt` *(immutable)*
**AIFeedback** — `id · messageId? · recommendationId? · rating(up|down) · reasonCode · comment? · userId · createdAt`
**AIPolicy** — `tenantId · submoduleKey · isEnabled · enabledRoles[] · dataBoundaries[] · monthlyQuota · costCap · tone · terminology · retentionDays · allowTraining(false) · fallbackBehaviour`
**AIKnowledgeSource** — `id · tenantId · type · title · fileRef · scopeIds[] · indexedAt · chunkCount · isActive · requiredPermission`
**AIQualityMetric** — `id · featureKey · period · acceptanceRate · overrideRate · avgConfidence · avgLatency · errorRate · costPerInteraction · sampleSize`

## 7.2 Referenced entities (read-only)

`User · Role · Site · Blok · Daire · Sakin · Personel · IsEmri · Gorev · Bildirim · TakvimOlayi · AidatTahakkuk · Odeme · Demirbas · BakimKaydi · Olay · SakinTalebi · Rapor · KPIDefinition · KPISnapshot · AlertInstance · DashboardLayout`

The AI Center holds references only. It writes to none of these directly; proposals become records through the owning module's API.

## 7.3 Relationships

```
User ──1:N──► AISession ──1:N──► AIConversation ──1:N──► AIMessage
AIMessage ──1:N──► AIFeedback
AIMessage ──N:M──► evidence records (polymorphic reference)
AIAgent ──1:N──► AIAgentRun ──1:N──► AIRecommendation
AIRecommendation ──0:1──► resulting record in a target module
AIPrediction ──N:1──► Demirbas | Site | Daire | KPIDefinition
AIDocument ──0:1──► IsEmri | Odeme (matched record)
Tenant ──1:N──► AIPolicy (one per submodule)
Every surface ──1:N──► AIAuditEntry
```

## 7.4 Statuses

**AIRecommendation** — `new → viewed → accepted | edited_accepted | dismissed | expired | blocked_by_rule`
**AIDocument** — `uploaded → processing → extracted → under_review → accepted | rejected | failed`
**AIAgent** — `active | paused | stopped | quota_exceeded | error`
**AIMessage** — `streaming | complete | stopped_by_user | failed | low_confidence | cached`
**AISession** — `active | idle | ended | terminated_by_policy`
**AIPrediction** — `current | superseded | expired`

## 7.5 Permissions

| Permission | Grants |
|---|---|
| `ai.view` | Open the AI Center |
| `ai.copilot.use` · `ai.chat.use` | Conversational surfaces |
| `ai.briefing.view` | Daily briefing |
| `ai.recommendation.view` · `ai.insight.view` | Proposals and observations |
| `ai.risk.view` · `ai.maintenance.view` · `ai.finance.view` | Specialised prediction surfaces |
| `ai.document.use` · `ai.report.generate` · `ai.kb.use` · `ai.meeting.use` | Document, report, knowledge, meeting |
| `ai.workflow.assist` · `ai.notification.tune` | Workflow and notification intelligence |
| `ai.automation.view` · `ai.automation.manage` | Agent console read / control |
| `ai.analytics.view` · `ai.quality.view` · `ai.cost.view` | Measurement surfaces |
| `ai.audit.view` | Audit log |
| `ai.prompt.use` · `ai.prompt.manage` | Prompt library use / authoring |
| `ai.settings.manage` | Governance console |
| `ai.rca.use` | Root cause analysis |

## 7.6 Business rules

1. No AI output writes to a business table without an explicit human acceptance event recorded against a named user.
2. Every assistant message must carry at least one evidence reference or be explicitly labelled as ungrounded.
3. Confidence below the tenant threshold renders the low-confidence state; it is never silently upgraded.
4. Agent authority above level 2 cannot be enabled in Sprint 02 by any configuration path.
5. Dismissal requires a reason code; the reason is retained as a quality signal.
6. Severity-1 alerts, statutory deadlines and financial threshold breaches are exempt from learned notification filtering.
7. Audit entries are immutable; corrections append, never overwrite.
8. Predictions are produced by statistical models; a generative model may explain a number but may never originate one.
9. A proposal that would violate a business rule is blocked at generation and the blocking rule is named to the user.
10. Individual staff productivity comparison requires an explicit permission and writes its own audit entry.
11. Quota exhaustion degrades to cheaper models with a visible notice before it degrades to refusal.
12. The session-level AI off switch takes effect immediately and requires no administrator involvement.

---

# STEP 8 — API DESIGN

**Base:** `/api/v1/ai` · **Auth:** OAuth 2.0 Bearer (JWT, 15-minute access token, refresh rotation) · **Tenant:** from token claims only · **Errors:** RFC 7807 · **Correlation:** `X-Request-Id` echoed and written to the audit trail · **Idempotency:** required on every POST that can create a record

| # | Method & path | Purpose | Input | Output | Permission | Rate limit |
|---|---|---|---|---|---|---|
| 1 | `POST /sessions` | Start a session | `scope`, `surface` | Session | `ai.view` | 30/min |
| 2 | `POST /copilot/ask` *(SSE)* | Ask; streamed answer | `question`, `scope`, `range`, `conversationId?`, `mode` | Stream + evidence + optional result set | `ai.copilot.use` | 20/min, 300/day |
| 3 | `POST /copilot/stop` | Stop generation | `messageId` | Partial message | `ai.copilot.use` | 60/min |
| 4 | `GET /conversations` · `GET /conversations/{id}` | List / read threads | `cursor` | Conversations | `ai.chat.use` | 120/min |
| 5 | `POST /conversations/{id}/save` · `DELETE /conversations/{id}` | Save / delete a thread | — | Conversation | self | 60/min |
| 6 | `POST /briefing/generate` | Daily briefing | `scope`, `role`, `date` | Narrative + evidence | `ai.briefing.view` | 10/min |
| 7 | `GET /recommendations` | Ranked proposals | `scope`, `category`, `minConfidence`, `status` | Recommendations | `ai.recommendation.view` | 120/min |
| 8 | `POST /recommendations/{id}/accept` | Accept and execute via target module | `edits?`, `idempotencyKey` | Created record ref | `ai.recommendation.view` + target permission | 30/min |
| 9 | `POST /recommendations/{id}/dismiss` | Dismiss | `reasonCode`, `comment?` | Updated | `ai.recommendation.view` | 60/min |
| 10 | `GET /insights` | Observations | `scope`, `category` | Insights | `ai.insight.view` | 120/min |
| 11 | `GET /predictions` | Predictions | `subjectType`, `scope`, `horizon` | Predictions with factors | `ai.maintenance.view` / `ai.risk.view` | 120/min |
| 12 | `GET /risk/heatmap` | Portfolio risk | `scope`, `dimension` | Scores + factors | `ai.risk.view` | 60/min |
| 13 | `POST /finance/forecast` | Collection forecast | `scope`, `horizon` | Forecast + band + drivers | `ai.finance.view` | 20/min |
| 14 | `POST /documents` | Upload for extraction | multipart, `docType`, `estateId` | Job id | `ai.document.use` | 20/min |
| 15 | `GET /documents/{id}` | Extraction result | — | Fields + per-field confidence + match | `ai.document.use` | 120/min |
| 16 | `POST /documents/{id}/accept` | Accept with corrections | `fields`, `idempotencyKey` | Created record ref | `ai.document.use` + target permission | 30/min |
| 17 | `POST /reports/from-prompt` | NL → report definition | `description`, `scope`, `range` | Report definition + preview | `ai.report.generate` | 15/min |
| 18 | `POST /kb/search` | Grounded answer | `question`, `scope` | Answer + citations, or insufficient-grounding | `ai.kb.use` | 60/min |
| 19 | `POST /workflow/draft-rule` | NL → automation rule | `description` | Draft rule + plain-language restatement + 12-month simulation | `ai.workflow.assist` | 15/min |
| 20 | `POST /rca` | Root cause analysis | `metricKey`, `period`, `scope` | Decomposition + correlations + hypotheses | `ai.rca.use` | 15/min |
| 21 | `GET /health-score` | Operational health | `scope` | Composite + dimension breakdown + weights | `ai.view` | 60/min |
| 22 | `GET /agents` · `PATCH /agents/{key}` | Agent console | `authorityLevel`, `isActive`, `spendCap` | Agent | `ai.automation.view` / `.manage` | 60/min |
| 23 | `POST /agents/{key}/kill` · `POST /agents/kill-all` | Stop | `reason` | Status | `ai.automation.manage` | 30/min |
| 24 | `GET /audit` | Audit log | `actor`, `surface`, `from`, `to`, `cursor` | Entries | `ai.audit.view` | 60/min |
| 25 | `GET /quality` · `GET /cost` | Quality and cost metrics | `period`, `featureKey` | Metrics | `ai.quality.view` / `ai.cost.view` | 60/min |
| 26 | `POST /feedback` | Rate an output | `messageId|recommendationId`, `rating`, `reasonCode` | Feedback | `ai.view` | 120/min |
| 27 | `GET /prompts` · `POST /prompts` | Prompt library | `category` / prompt body | Prompts | `ai.prompt.use` / `.manage` | 60/min |
| 28 | `GET /policy` · `PUT /policy` | Governance | Policy object | Policy | `ai.settings.manage` | 30/min |
| 29 | `POST /session/disable-ai` | Session kill switch | — | Confirmation | `ai.view` | 10/min |

**Security controls on every endpoint.** TLS 1.3 · tenant isolation asserted at the retrieval layer with automated tests per build · retrieval executes as the requesting user, never a service account · prompt-injection sanitisation on all ingested content · PII redaction before logging · schema validation on every structured output · no-training guarantee configurable per tenant · quota and cost caps enforced before generation · full audit entry per call.

**Performance contract.** Intent classification p95 ≤ 150ms · first streamed token ≤ 1.5s · full answer p95 ≤ 6s · retrieval p95 ≤ 400ms · predictions served from cache p95 ≤ 250ms · document extraction ≤ 30s for a 10-page PDF (asynchronous with progress).

---

# STEP 9 — VALIDATIONS

## 9.1 Permission rules

- Feature permission checked before generation; data permission enforced in retrieval; action permission checked at execution. All three server-side.
- A `scopeId` outside the user's grant returns `403`, never a filtered `200` — silent filtering conceals authorisation defects.
- Accepting a recommendation re-checks the target module's permission at execution time, not at proposal time; permissions can change between the two.
- Personnel special-category data is unreachable by any AI endpoint at any permission level.
- Individual productivity comparison requires an explicit permission and writes its own audit entry.
- Resident-scope data is never reachable from staff AI surfaces beyond the user's estate grant.

## 9.2 Business rules

- No write without a recorded human acceptance.
- Every assistant output carries evidence references or an explicit ungrounded label.
- Agent authority is capped at level 2 in this sprint; levels 3–4 are rejected server-side even if requested.
- Proposals that violate a business rule are blocked at generation with the rule named.
- Predictions never originate from a generative model.
- Dismissal requires a reason code.
- Notification exemptions (severity-1, statutory, financial threshold) cannot be overridden by learned ranking.

## 9.3 Prompt validation

| Check | Rule |
|---|---|
| Length | 3–4.000 characters; below rejected as too vague, above rejected with a request to narrow |
| Injection | Instruction-like patterns in retrieved content neutralised; retrieved text is data, never instruction |
| Scope | A prompt naming an estate outside the user's grant is refused with an explanation, not silently rescoped |
| PII | Detected personal identifiers redacted before logging; the user is told redaction occurred |
| Language | Turkish and English supported; other languages answered with a capability notice |
| Ambiguity | Where a question has multiple valid readings, the module asks one clarifying question rather than guessing |
| Action intent | Any action-intent prompt renders a structured preview; free text alone never triggers execution |

## 9.4 Duplicate detection

- Identical prompt with identical context within 60 seconds serves the cached answer, labelled as cached.
- A recommendation matching an open recommendation on agent, subject and category is suppressed and its occurrence counter incremented.
- A drafted work order matching an open work order on estate, asset and category within 24 hours is flagged as a probable duplicate — proposed for merge, never merged automatically.
- Re-uploading a document with the same hash returns the existing extraction instead of reprocessing.
- Idempotency keys prevent double execution on retried acceptance.

## 9.5 Security validation

- Every retrieval passes an ACL filter before ranking.
- Structured outputs are schema-validated; failures produce an error state, never a rendered guess.
- Output filtering blocks any record reference outside the requesting user's scope, as a second line of defence behind retrieval filtering.
- Uploaded documents are virus-scanned, type-verified and size-limited before processing.
- Rate limiting and anomaly detection on interaction patterns; unusual volume suspends the session and notifies security.
- Session AI kill switch takes effect immediately, server-side.

## 9.6 Error handling

| Case | Behaviour |
|---|---|
| Model unavailable | Fall back to a lower tier with a visible reduced-depth notice; if all unavailable, deterministic surfaces continue |
| Timeout | Partial stream retained; resume offered; nothing partial is presented as complete |
| Rate limit | Countdown with the reset time; queued rather than lost |
| Insufficient grounding | Explicit refusal naming what was searched; never an ungrounded answer |
| Permission denied | Names the required permission and how to request it |
| Schema validation failure | Error state with correlation ID; no partial render |
| Quota exhausted | Degrade to cheaper models with notice, then refuse with a clear reset time |
| Document unreadable | Names the reason (scanned without OCR, encrypted, corrupt) and the remedy |
| Injection detected | Content neutralised, generation continues, security event logged |

## 9.7 Warnings (non-blocking)

- "AI çıktısı — insan onayı gerektirir" on every generated output, without exception.
- "Düşük güven — kaynak kayıtları doğrulayın" below the confidence threshold.
- "Bu bir hipotezdir, nedensellik kanıtı değildir" on every correlation-derived claim.
- "Önbellekten sunuldu · 14:32" on cached answers.
- "Yalnızca yetkiniz dahilindeki kayıtlar tarandı — 12 siteden 12'si" on every scoped answer.
- "Bu dönem henüz tamamlanmadı" when comparing a partial period against a complete one.
- "Aylık kotanızın %80'i kullanıldı" before hard limits engage.
- "Model kapasitesi nedeniyle daha hızlı bir modele geçildi" when routing degrades.
