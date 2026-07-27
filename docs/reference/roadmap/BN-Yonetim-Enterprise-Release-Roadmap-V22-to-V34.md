# BN Yönetim — Enterprise Release Roadmap
## Version 22 → Version 34

**Document type:** Enterprise Product Release Roadmap
**Owner:** Principal Enterprise Product Architect / Enterprise UX Director
**Baseline:** Version 22 (approved, frozen, production)
**Horizon:** Twelve sequential releases (V23 → V34)
**Status:** Planning of record
**Date:** 25 July 2026

---

## 0. How to read this document

This is not a design concept and not a redesign proposal. It is the release plan of an existing enterprise SaaS platform that is already in production, in the same way Microsoft plans Office release trains: **every release is an additive layer on top of the frozen V22 foundation.**

Three reading rules apply to every page that follows:

1. **Nothing in V22 is touched.** Where a release "improves the dashboard," it means new widgets, new states, new density options and new data inside the existing V22 grid, cards, glass surfaces and sidebar — never a new dashboard.
2. **Every new surface is built from the V22 Component Library.** No release introduces a new visual language, a new typeface, a new palette, a new card style or a new homepage. New components are compositions of existing primitives, registered as new entries in the same design system.
3. **Feature names are given bilingually** (English concept / Turkish product label), because the shipping product UI is Turkish. The English label is the internal roadmap name; the Turkish label is what the customer sees.

---

## 1. Baseline inventory — what Version 22 already is

This inventory is the contract. Every item below is permanent, frozen and referenced by later releases. It is recorded here so that no future release team can accidentally "improve" something by replacing it.

### 1.1 Brand and design foundation (frozen)

| Token | Value | Status |
|---|---|---|
| Primary | `#0E7490` | Frozen — never changed |
| Secondary | `#2563EB` | Frozen |
| Surface / dark | `#0F172A` | Frozen |
| Deep surface / darker | `#060B14` | Frozen |
| Body text | `#E2E8F0` | Frozen |
| Success accent | `#10B981` | Frozen |
| Typeface | DM Sans 300 / 400 / 500 / 600 / 700 / 800 | Frozen |
| Iconography | Lucide | Frozen |
| Glass surface | `rgba(15,23,42,0.6)` + `blur(16px)` + `1px rgba(255,255,255,0.06)` border | Frozen |
| Glow | `0 0 60px rgba(14,116,144,0.15)` | Frozen |
| Gradient text | `linear-gradient(135deg, #0E7490, #2563EB)` | Frozen |
| Motion | `fadeUp` 0.6s ease reveal; 0.2s nav transitions; 0.6s bar growth | Frozen |
| Numerics | Tabular numerals on all counters and financial figures | Frozen |
| Active nav state | 3px right border `#0E7490` + `rgba(14,116,144,0.15)` fill | Frozen |
| Layout | `max-w-7xl` centred content, 12-column responsive grid | Frozen |

### 1.2 Public platform surface (frozen)

Top bar (phone, e-mail, WhatsApp, TR|EN switch, search, Giriş Yap) · Header with Platform / Modüller / AI / Referanslar / Blog + "Demo Talep Et" CTA · Hero with dual CTA and product image · Trusted-by strip (six reference estates) · Platform section · Eight module cards · AI Center (three capability blocks) · "Why BN" six-reason grid · Four animated statistic counters · Three testimonials · Three blog cards · Closing CTA · Four-column footer (Platform / Şirket / İletişim).

### 1.3 Application surface (frozen)

Sidebar with ten views — **Dashboard · BN AI Bölümü · Grafikler · AI Chat · Görevler · Takvim · Bildirimler · Site Haritası · Kartlar · Widgetlar** — plus the mobile nav toggle and collapsible mobile menu.

Dashboard contents: four KPI stat cards (Toplam Site 150 · Aktif Görev 47 · Bildirimler 12 · Toplam Sakin 25.000+), recent activity feed, quick-filter chips (Tüm Siteler / per-estate), monthly dues-collection bar chart (Aylık Aidat Tahsilatı ₺), AI chat panel, prioritised task list (Acil / Orta / Düşük), month calendar, notification stack, site map with block/apartment counts (A–D Blok), info cards, and the widget set (İstanbul weather, energy consumption trend, collection rate %94, open work orders).

### 1.4 Domain model implied by V22 (frozen, extended only additively)

Estate (Site) → Block (Blok) → Unit (Daire) → Resident (Sakin) · Work Order (İş Emri) · Task (Görev) · Dues (Aidat) · Notification (Bildirim) · Calendar Event · AI Conversation.

**Every release below extends this graph. No release re-parents, renames or removes an entity.**

---

## 2. Evolution governance — the rules that make twelve releases feel like one product

A roadmap without governance becomes a redesign by accident. These rules are binding on every release from V23 to V34.

### 2.1 The additive-only contract

- **Add, never replace.** A new component may sit beside an existing one; it may not delete it.
- **Extend, never re-scope.** New fields join existing records; existing fields keep their meaning.
- **Compose, never invent.** New screens are assembled from registered V22 primitives.
- **Default to the old behaviour.** Every new capability ships off or opt-in; the V22 experience remains the default path until a customer chooses otherwise.

### 2.2 Design token extension policy

New tokens are permitted only as **derivations** of the frozen set:

- Semantic aliases (`--status-critical`, `--status-warning`) mapped onto existing hues, never new hues.
- Tints and shades generated from `#0E7490` / `#2563EB` on a fixed ramp.
- New spacing values only on the existing 4px scale.
- New type sizes only from the existing DM Sans scale; no new families, no new weights.

Each release appends to a **Design Token Changelog** (Appendix B). Nothing is ever removed from it.

### 2.3 Component versioning

Components follow semantic versioning inside the library: `Card v1 → Card v1.1` (a new density prop) rather than `Card v2` (a new card). A major bump requires Design Board approval and is expected **zero times** across V23–V34.

### 2.4 Release cadence and shape

Twelve releases across roughly a three-year horizon: quarterly feature trains, monthly patch trains. Each train is: 2 weeks discovery → 6 weeks build → 2 weeks hardening → 2 weeks staged rollout (internal → design partners → 10% → 50% → GA).

### 2.5 Definition of Done — applied to every release

A release ships only when all of the following are true: zero visual regressions against the V22 reference screenshots · WCAG 2.2 AA on all new surfaces · no performance budget exceeded · full Turkish and English localisation · KVKK data-processing record updated · admin controls and audit events exist for every new capability · migration is a no-op for existing customers · documentation and in-product release notes published.

### 2.6 Deprecation policy

There is none in the destructive sense. Superseded capabilities become **legacy-supported**: still present, still working, marked in the admin console as "classic," never removed from the UI without a customer-initiated setting.

### 2.7 Performance budgets (enforced from V23, tightened through V34)

LCP ≤ 2.0s · INP ≤ 200ms · CLS ≤ 0.05 · dashboard JS ≤ 250KB gzip · first meaningful KPI card ≤ 1.2s · every list virtualised beyond 100 rows.

---

## 3. Release map at a glance

| Release | Theme | Headline capability | Primary beneficiary |
|---|---|---|---|
| **V23** | Enterprise polish | Widget framework, dashboard density, navigation depth | All users |
| **V24** | Orchestration | Workflow Center, Automation Builder, Approvals, Notification Center | Operations |
| **V25** | Assistance | AI Copilot, natural-language search, predictive suggestions, smart reports | All users |
| **V26** | Insight | Executive Dashboard, Power Analytics, KPI Center, Forecasting | Executives |
| **V27** | Physical operations | Asset Management, Maintenance Intelligence, Risk, Incident Center | Technical teams |
| **V28** | Financial depth | Financial Analytics, Budget Forecast, Cash Flow, Expense Intelligence | Finance |
| **V29** | Community | Communication Center, Resident Portal, Announcements, Surveys | Residents & boards |
| **V30** | Field & mobile | Enterprise mobile, offline mode, push, field operations | Field staff |
| **V31** | Extensibility | Marketplace, plugins, API Center, Developer Portal | Partners & IT |
| **V32** | Autonomy | AI Automation Center, Workflow Designer, Rule Engine, recommendations | Operations & IT |
| **V33** | Command | Enterprise Intelligence, Executive Cockpit, Digital Twin, Command Center | Leadership |
| **V34** | Maturity | Optimisation, micro-interactions, accessibility, final polish | Everyone |

**Narrative arc:** V23 perfects what exists → V24–V25 make the product *act* and *assist* → V26–V28 make it *understand* (operationally and financially) → V29–V30 extend it to *everyone who lives and works in the buildings* → V31–V32 make it a *platform* that others build on and that runs itself → V33 makes it a *command surface for leadership* → V34 makes the whole twelve-release accumulation feel like one coherent, fast, accessible product.

---

# VERSION 23 — Enterprise Polish

*Train theme: make the existing product feel like it has been in production for a decade.*

### 1. Release Vision
V23 adds no new business domain. It takes the ten views, the widget set and the navigation that V22 already ships and gives them the depth that enterprise customers expect after their first year of real usage: configurable widgets, saved views, density control, richer empty and error states, and a navigation model that survives 150 estates instead of demoing well with six. This is the release that converts a well-designed product into a well-worn one.

### 2. New Enterprise Features
- **Widget Framework / Widget Çerçevesi** — the existing `Widgetlar` view becomes a registry. Widgets gain size (1×1, 2×1, 2×2), refresh interval, data scope and permission metadata. All four V22 widgets (weather, energy, collection rate, open work orders) are re-registered unchanged as the first four catalogue entries.
- **Saved Views / Kayıtlı Görünümler** — any combination of quick-filter chips, date range and sort becomes a named, shareable view ("Acil işler — Yıldız Sitesi").
- **Global Command Palette / Komut Paleti** (`Ctrl/⌘ + K`) — jump to any estate, block, unit, task or view. Additive: the V22 top-bar search remains exactly where it is and now shares the same index.
- **Multi-estate Scope Selector / Portföy Seçici** — the quick-filter chip row gains an overflow selector supporting estate groups, regions and portfolios for customers past ~20 estates.
- **Bulk Actions / Toplu İşlem** — multi-select on task and notification lists with a bulk action bar.
- **Notification digest preferences** — per-user daily/weekly roll-ups, ahead of the full Notification Center in V24.

### 3. UX Improvements
- **Density modes** — Comfortable (V22 default, unchanged) and Compact, a user preference, applied via a single spacing token swap on the existing 4px scale.
- **Complete state coverage** — every list, chart and widget receives designed empty, loading (skeleton), error, partial-data, permission-denied and zero-results states in the existing glass card treatment.
- **Sticky table headers, column resize, column visibility** on all V22 tables.
- **Breadcrumbs** for Site → Blok → Daire → Sakin navigation, using existing type scale.
- **Inline validation and autosave** on all forms, with an explicit "Saved / Kaydedildi" affordance in the success accent.
- **Keyboard model** — full tab order, visible focus rings on `#0E7490`, arrow-key list navigation, `Esc` dismissal, and a shortcuts help sheet.
- **Micro-copy pass** — all Turkish strings reviewed for enterprise register and consistency (siz/formal address, consistent verb forms, consistent date formatting `25 Temmuz 2026`).

### 4. Dashboard Enhancements
- **Drag-and-drop layout** with per-role default layouts; the V22 layout ships as the immovable default template "Klasik".
- **Comparison mode** on the Aylık Aidat Tahsilatı chart — previous period and previous year overlays.
- **KPI cards gain trend and target** — the four stat cards keep their exact composition and add a sparkline, delta vs. previous period and an optional target line.
- **Drill-through** — every KPI, chart segment and widget becomes clickable into a filtered list view. Clicking "Aktif Görev 47" now opens Görevler pre-filtered.
- **Time-range control** on the dashboard header (Today / 7d / 30d / Quarter / Year / Custom), persisted per user.
- **Personal "My Day" widget** — the current user's tasks, approvals and calendar items in one 2×2 card.

### 5. AI Enhancements
- **BN AI context awareness** — the AI Chat panel now knows which estate and view the user is in, and answers scoped accordingly.
- **Suggested prompts** on the AI Bölümü view, derived from the user's role and current data.
- **Summarisation** — "Bu haftayı özetle" produces a plain-language rollup of work orders, collections and incidents.
- **Answer provenance** — every AI answer shows which records it drew on and links to them, establishing the trust pattern that V25 and V32 depend on.

### 6. Reporting Enhancements
- **Report library** — the ad-hoc exports of V22 become a catalogue of ~20 standard reports (aidat tahsilat, gecikme listesi, iş emri kapanış süresi, personel puantaj, demirbaş listesi).
- **Export everywhere** — every table and chart exports to XLSX, CSV and PDF with correct Turkish characters and locale-formatted currency.
- **Scheduled e-mail delivery** of any saved report, daily/weekly/monthly.
- **Branded PDF output** using the frozen palette and DM Sans, with estate logo and yönetici signature block.

### 7. Analytics Enhancements
- **Trend baselines** — every metric gains a 13-month history so that "↓ 12% geçen aya göre" becomes verifiable rather than declarative.
- **Cohort comparison** — estates compared against portfolio median on collection rate, work-order closure time and cost per unit.
- **Data dictionary** — every metric gets a definition, formula and refresh timestamp, visible on hover. This ends the "which number is right" conversation before V26 scales analytics up.

### 8. Automation Enhancements
- **Recurring tasks / Tekrarlayan görevler** — the periodic realities of the domain (asansör bakımı, jeneratör yağ değişimi, yangın tüpü kontrolü) become schedules rather than manually re-created tasks.
- **Reminder rules** — dues due-date reminders, overdue escalation and maintenance-due notifications, configurable per estate.
- **Auto-assignment** of work orders by category and estate to the responsible technician.

### 9. Administrator Features
- **Role & permission matrix** — Yönetici, Denetçi, Muhasebe, Teknik Personel, Site Sakini, Portföy Yöneticisi, System Admin — with per-module read/write/approve granularity.
- **Audit log** — who did what, when, from where, on every record; immutable and exportable.
- **User lifecycle** — bulk invite, deactivate, transfer ownership of tasks when staff leave.
- **Tenant settings console** — per-estate branding fields, fiscal calendar, notification defaults, working hours.
- **Feature flag console** — admins see and control every V23+ capability, guaranteeing the "V22 by default" promise.

### 10. Executive Features
- **Portfolio summary card** — one card summarising all 150 estates: total collection rate, open critical work orders, resident count, month-over-month movement.
- **Exception list** — the five estates most deviating from portfolio norms, surfaced without the executive constructing a query.
- **Weekly executive digest e-mail** — the first executive artefact, deliberately shipped early so that V26's Executive Dashboard replaces a habit rather than creating one.

### 11. Mobile Improvements
- Responsive audit of all ten views at 360px, 390px and 768px.
- Bottom-sheet interaction pattern for filters and actions, replacing desktop dropdowns on touch — same tokens, touch-appropriate mechanics.
- 44×44px minimum touch targets throughout.
- Pull-to-refresh on dashboard and lists.
- The V22 mobile menu toggle and mobile nav are preserved exactly; a persistent bottom tab bar is added as an option for phone-primary users.

### 12. Security Improvements
- MFA (TOTP + SMS) with per-role enforcement policy.
- Session management: idle timeout, device list, remote revoke.
- Password policy, breach-list check, forced rotation for privileged roles.
- Rate limiting and lockout on authentication endpoints.
- KVKK groundwork: data inventory, retention clocks per entity, aydınlatma metni surfaced at first login, VERBİS-ready processing records.

### 13. Performance Improvements
- **Build pipeline replaces CDN delivery** — Tailwind is compiled and purged, Lucide is tree-shaken to used icons only. Byte-for-byte identical rendering, a large drop in transferred bytes. This is the purest expression of the roadmap philosophy: massive engineering improvement, zero visual change.
- Route-level code splitting across the ten views; the dashboard no longer pays for the AI Chat bundle.
- Server-side pagination and virtualised lists.
- Query result caching with stale-while-revalidate on KPI cards.
- Image optimisation (AVIF/WebP, responsive `srcset`, explicit dimensions to hold CLS at zero).
- `prefers-reduced-motion` honoured for `fadeUp` and bar animations.

### 14. Business Value
Reduced support load through complete state coverage and better error messaging; measurably faster daily workflows for portfolio managers via saved views and the command palette; a credible security posture for enterprise procurement (MFA, audit log, RBAC) that unblocks larger deals; and a performance profile that makes the product usable on the mid-range Android devices site staff actually carry.

### 15. Why this release exists
Because the fastest way to ruin twelve releases of evolution is to start stacking modules onto foundations that were built for a demo. V23 buys the structural capacity — widget registry, permission matrix, audit log, saved views, performance headroom, state coverage — that every release from V24 to V34 will consume. It is the least visible and most important release in this roadmap.

**Preserved from V22:** every colour, every font weight, every card, the ten-item sidebar, the four stat cards, the bar chart, the site map, all four widgets, the entire marketing site.
**Non-goals:** no new domain modules, no new pages on the public site, no changes to the information architecture.

---

# VERSION 24 — Workflow & Orchestration

*Train theme: the product stops being a place where work is recorded and becomes the place where work happens.*

### 1. Release Vision
V22 shows tasks. V23 makes tasks recurring. V24 gives them a lifecycle: a defined process, an owner at each stage, an approval gate where money or risk is involved, an SLA clock, and a single inbox where every human decision waiting on you is visible. The Görevler view is not replaced — it becomes one lens onto a workflow engine that now sits underneath it.

### 2. New Enterprise Features
- **Workflow Center / İş Akışı Merkezi** — a new sidebar view listing every process instance, its stage, owner, age and SLA state.
- **Automation Builder / Otomasyon Oluşturucu** — a no-code trigger → condition → action rule builder (when a work order in category *Asansör* stays open 48h, escalate to the technical lead and notify the yönetici).
- **Approval Workflow / Onay Akışı** — multi-step, threshold-based approvals with delegation, out-of-office substitutes, parallel and sequential chains, and full justification capture. Purpose-built for the domain: expenditure above the board-approved limit, contractor selection, budget line changes.
- **Notification Center / Bildirim Merkezi** — the V22 Bildirimler view is preserved and gains a full backend: channels (in-app, e-mail, SMS, WhatsApp), per-user and per-category preferences, digest scheduling, delivery receipts and a complete history.
- **Unified Inbox / İşlem Kutusu** — every approval, mention, assignment and exception awaiting the current user in one prioritised list.
- **SLA management** — response and resolution targets per work-order category and estate contract, with breach prediction.
- **Process templates** — pre-built flows shipped with the product: arıza bildirimi → iş emri → tedarikçi → onay → kapanış; aidat gecikme kademeli hatırlatma; yeni sakin kaydı; genel kurul hazırlık.

### 3. UX Improvements
- **Stage timeline component** — a horizontal progress rail on every work order and approval, built from existing pill and card primitives.
- **Action-first task detail** — the primary action for the current stage is always the visually dominant control.
- **@mentions and threaded comments** on every record, with attachment support.
- **"Waiting on" clarity** — every in-flight item states, in one line, who it is waiting for and how long it has been waiting.
- **Undo window** on destructive and bulk actions.
- **Rule builder UX** — a plain-language sentence view of every rule alongside the structured editor, so non-technical yöneticis can verify what they built.

### 4. Dashboard Enhancements
- New widgets, all in the V22 card treatment: **Bekleyen Onaylar**, **SLA Riski**, **İş Akışı Darboğazları** (bottleneck), **Otomasyon Tasarrufu** (hours saved this month).
- The Görevler list gains stage, owner and SLA columns.
- Recent activity feed becomes workflow-aware, showing stage transitions and approvals alongside the existing entries.

### 5. AI Enhancements
- **AI triage** — incoming resident reports are auto-classified by category, urgency and likely responsible trade, with confidence shown and one-click override.
- **Duplicate detection** — "three residents reported this leak in B Blok; merge into one work order?"
- **Next-action suggestion** on stalled items.
- **Draft generation** — AI drafts the resident notification, the contractor brief and the closure summary; a human always approves before send.

### 6. Reporting Enhancements
- **Process performance report** — cycle time, touch count and rework rate per process and per estate.
- **Approval audit report** — who approved what, at what amount, with what justification, exportable for denetçi review.
- **SLA compliance report** per estate and per contractor.
- **Notification delivery report** — sent, delivered, opened, failed, by channel.

### 7. Analytics Enhancements
- **Bottleneck analysis** — which stage consumes the most elapsed time across the portfolio.
- **Workload distribution** — task load per staff member, surfacing both overload and idle capacity.
- **First-time-fix rate** by category and contractor — the leading indicator that V27's maintenance intelligence will build on.

### 8. Automation Enhancements
This is the release's centre of gravity. Shipping automation library: dues reminder ladders (T-7, T-0, T+7, T+30 with escalating tone), automatic overdue interest calculation, periodic maintenance work-order generation, contractor follow-up chasers, auto-close after resident confirmation, weekly board summary generation, staff shift reminders, and document expiry alerts (sözleşme, sigorta, asansör muayene etiketi).

### 9. Administrator Features
- Workflow designer permissions, sandbox testing and versioning — rules can be tested against historical data before activation.
- Approval matrix configuration per estate, with monetary thresholds and role mappings.
- Notification governance: rate caps to prevent resident spam, quiet hours, mandatory-channel rules for legal notices.
- Automation activity log with a global kill switch.

### 10. Executive Features
- **Approval queue for executives** with mobile-friendly one-tap approve/reject and full context inline.
- **Governance view** — every pending decision above threshold across the portfolio.
- **Automation ROI card** — hours and cost avoided, made explicit so that investment in the platform is defensible at board level.

### 11. Mobile Improvements
- Push-ready notification architecture (delivery lands fully in V30).
- Mobile approval flow designed for the reality of approving a 40.000 ₺ contractor invoice from a phone: full context, amount prominent, justification required.
- Quick task creation from mobile with photo attachment.

### 12. Security Improvements
- Segregation of duties enforcement — the requester cannot be the approver.
- Digital approval records with timestamp, IP and device, non-repudiable and immutable.
- Sensitive-action step-up authentication (re-authenticate to approve above threshold).
- Encrypted attachment storage with virus scanning.

### 13. Performance Improvements
- Asynchronous job queue for rule evaluation and notification fan-out; no user action blocks on automation.
- Event-driven architecture with an append-only event log — also the substrate for V33's Digital Twin.
- Optimistic UI updates on stage transitions.
- Notification batching to protect e-mail and SMS deliverability.

### 14. Business Value
Work-order cycle time falls because nothing sits unnoticed; collection improves because the reminder ladder never forgets; administrative labour drops measurably as recurring coordination is automated; and every financial decision acquires a defensible audit trail — which matters enormously in a domain governed by owner assemblies, denetçi review and the Kat Mülkiyeti Kanunu.

### 15. Why this release exists
Because enterprise buyers do not buy dashboards; they buy control. V24 is the release where BN Yönetim becomes a system of action rather than a system of record — and it must come before AI (V25) and before analytics (V26), because AI needs processes to accelerate and analytics needs process data to measure.

**Preserved from V22:** the Görevler view, the Bildirimler view and the Takvim view all keep their V22 presentation; workflow data is added as new columns and new tabs.
**Non-goals:** no BPMN-grade process modelling (that maturity arrives in V32), no external contractor portal yet.

---

# VERSION 25 — AI Copilot

*Train theme: every user gets an expert colleague who has read every record.*

### 1. Release Vision
V22 shipped BN AI as a chat panel and an AI section. V25 turns that promise into an operational copilot present throughout the product: it understands natural language questions about the portfolio, it anticipates what the user is about to need, it drafts the documents this domain drowns in, and it produces reports on request. The V22 AI Chat panel is preserved exactly and becomes one entry point among several into a far more capable engine.

### 2. New Enterprise Features
- **AI Copilot / BN Copilot** — a context-aware assistant available on every view, aware of the current estate, record and user role.
- **Natural Language Search / Doğal Dil Arama** — "Yıldız Sitesi'nde üç aydır aidat ödemeyen daireler" returns a live, filterable, exportable result set, not a text answer.
- **Predictive Suggestions / Öngörülü Öneriler** — proactive cards: dues collection is tracking below the same period last year; the jeneratör service interval is approaching; this contractor's average closure time has doubled.
- **Smart Reports / Akıllı Raporlar** — describe a report in Turkish, receive a real report object that can be saved, scheduled and shared.
- **Document intelligence** — upload a contractor invoice, a contract or a meeting minute; the system extracts parties, amounts, dates and obligations, and files them against the right estate.
- **Meeting assistant** — genel kurul and board meeting agendas, minute drafting and decision extraction into trackable tasks.

### 3. UX Improvements
- **Ambient copilot affordance** — a persistent, unobtrusive entry point in the header using the frozen gradient treatment; never a modal that blocks work.
- **Conversational refinement** — every AI result can be narrowed in follow-up turns without restating context.
- **Explainability by default** — each suggestion shows its evidence, its confidence and a one-tap path to the underlying records.
- **Human-in-the-loop everywhere** — AI drafts; a person sends. No AI output reaches a resident, a contractor or an accounting ledger without explicit approval.
- **Feedback loop** — thumbs up/down with reason capture on every AI output, feeding the quality dashboard in the admin console.

### 4. Dashboard Enhancements
- **AI Insights strip** — up to three ranked, dismissible insight cards at the top of the dashboard, in the existing card style.
- **Natural language dashboard filtering** — "sadece kritik olanlar, son 30 gün."
- **Anomaly badges** on KPI cards when a metric deviates materially from its own history.
- **AI-generated narrative summary** beneath the collection chart: what happened, why, what to do.

### 5. AI Enhancements
- Retrieval-augmented generation grounded strictly in tenant data, with hard tenant isolation.
- Turkish-first language quality, including domain vocabulary (aidat, demirbaş, kat malikleri kurulu, işletme projesi, gecikme tazminatı) and correct formal register.
- Role-aware responses — a denetçi, a muhasebeci and a teknik personel asking the same question receive appropriately scoped answers, never data outside their permissions.
- Conversation memory within a session; explicit, user-controlled memory across sessions.
- Model routing: cheap fast models for classification, stronger models for analysis and drafting.

### 6. Reporting Enhancements
- **Report from prompt** — natural language to a structured report definition, editable afterwards in the normal report builder.
- **Automatic executive narrative** attached to every scheduled report.
- **Anomaly annotation** — reports call out what changed and why before the reader has to find it.
- **Multi-estate comparative reports** generated conversationally.

### 7. Analytics Enhancements
- **Predictive collection scoring** — likelihood of on-time payment per unit, driven by payment history, ageing and seasonality, used to target reminder intensity rather than to penalise residents.
- **Cost anomaly detection** on expense lines against estate history and portfolio peers.
- **Sentiment analysis** on resident reports and comments, producing a satisfaction trend per estate.
- **Correlation discovery** — surfaced as hypotheses for humans to judge, never as causal claims.

### 8. Automation Enhancements
- **AI-authored automation rules** — describe the desired behaviour; the system generates a V24 rule for human review and activation.
- **Auto-categorisation** of expenses to the correct budget line.
- **Smart routing** of incoming requests to the right person by content, load and past resolution success.
- **Draft-and-hold** — AI prepares the full response; the human presses send.

### 9. Administrator Features
- **AI governance console** — enable/disable per module, per role, per estate.
- **Usage and cost dashboard** with per-tenant quotas.
- **Quality dashboard** — accuracy, acceptance rate, override rate, feedback themes.
- **Prompt and policy management** — tenant-level instructions (tone, terminology, escalation rules) without any code change.
- **Data boundary controls** — explicit configuration of what the AI may and may not read, with an audit trail of every access.

### 10. Executive Features
- **Ask-the-portfolio** — natural language questions across all 150 estates, answered with sourced figures.
- **Daily executive brief** generated each morning: what changed, what needs attention, what is trending.
- **Scenario questions** — "if collection stays at this rate, when does the maintenance reserve run short?"

### 11. Mobile Improvements
- Voice input for the copilot — designed specifically for technicians with dirty hands and no keyboard.
- Photo-to-work-order: photograph a fault, receive a drafted work order with category, urgency and location pre-filled.
- Mobile-optimised short-form AI answers with a "detay" expansion.

### 12. Security Improvements
- Strict tenant isolation at the retrieval layer, verified by automated tests every build.
- Prompt injection defences on all ingested documents and resident-submitted text.
- PII redaction in prompts and logs; configurable no-training guarantees.
- Full AI interaction audit log — who asked what, what data was reached, what was produced.
- KVKK-compliant handling of automated processing, including the right to a human decision.

### 13. Performance Improvements
- Streaming responses so perceived latency stays low.
- Embedding cache and pre-computation of common portfolio queries.
- Graceful degradation: if the AI service is unavailable, every V22–V24 capability continues working untouched.
- Strict token budgets per request to keep unit economics predictable at 150-estate scale.

### 14. Business Value
The reporting burden that consumes days of a yönetici's month collapses to minutes. New staff become productive without learning query syntax or the report catalogue. Collection improves through targeted rather than uniform reminders. And the AI story — already promised on the V22 marketing site — becomes a defensible product capability rather than a claim.

### 15. Why this release exists
Because the V22 platform already tells the market it is AI-powered, and V24 has just produced the process data that makes real AI possible. V25 pays off the brand promise with substance, and does it after the workflow layer exists so the copilot has something meaningful to act upon.

**Preserved from V22:** the AI Chat view and the AI Bölümü view keep their layout, their eight cards and their hologram treatment; the copilot is added around them.
**Non-goals:** no autonomous action without human approval — that governance question is deliberately deferred to V32.

---

# VERSION 26 — Executive Intelligence

*Train theme: the people who fund the platform can finally see what it is doing.*

### 1. Release Vision
Through V25 the product has served operators. V26 serves the people operators report to: portfolio owners, board members, denetçi and the management company's own leadership. It adds an executive layer — a dedicated dashboard, a governed KPI system, a real analytics engine and forecasting — without touching the operational dashboard that daily users depend on.

### 2. New Enterprise Features
- **Executive Dashboard / Yönetici Panosu** — a new top-level view, portfolio-first, designed for a five-minute read: health of the portfolio, exceptions, trends, decisions pending.
- **Power Analytics / Gelişmiş Analitik** — self-service exploration: dimensions, measures, filters, cross-tabs, saved analyses, on a governed semantic model.
- **KPI Center / KPI Merkezi** — every metric defined once, with owner, formula, target, threshold, refresh cadence and history. The single source of numeric truth.
- **Forecast Dashboard / Tahmin Panosu** — projections for collection, expenditure, occupancy and maintenance demand, with confidence bands.
- **Benchmarking** — each estate against portfolio, region and comparable-type peers.
- **Scorecards** — a composite health score per estate combining financial, operational and satisfaction dimensions, fully transparent in its weighting.

### 3. UX Improvements
- **Progressive disclosure** — the executive view opens at portfolio level and drills to estate, block and unit through the same interaction pattern at every depth.
- **Annotation layer** — executives can comment on any data point; comments travel with the metric and notify the responsible owner.
- **Presentation mode** — full-screen, high-contrast rendering of any dashboard for board meetings, using the frozen palette.
- **Consistent chart grammar** — one chart type per question type, applied across the whole product, so a bar always means the same class of thing.

### 4. Dashboard Enhancements
- The V22 operational dashboard is entirely unchanged and gains an optional "Yönetici görünümü" toggle.
- New executive widgets: Portfolio Health Score, Collection Forecast, Cost per Unit, Resident Satisfaction Index, Risk Exposure, Decisions Pending.
- **Period-over-period everywhere** — every executive figure shows movement, not just level.
- **Exception-first ordering** — the dashboard leads with what is wrong, not with what exists.

### 5. AI Enhancements
- **Automatic insight generation** on the executive dashboard: what moved, by how much, driven by which estates.
- **Root-cause narration** — "collection fell 4 points, 80% attributable to three estates, all onboarded within the last quarter."
- **Forecast explanation** in plain Turkish, including which assumptions dominate the projection.
- **Executive Q&A** with drill-through to the underlying records.

### 6. Reporting Enhancements
- **Board reporting pack** — the full set a Turkish estate management requires, generated on schedule: faaliyet raporu, gelir-gider tablosu, aidat tahsilat özeti, iş emri performansı, demirbaş durumu.
- **Report builder** — drag-and-drop composition from KPI Center metrics, saved as reusable templates.
- **Multi-format distribution** — PDF, XLSX, in-product and secure link, with recipient-level access control.
- **Report versioning** — every distributed report is archived exactly as sent, which matters when a figure is later disputed at an owners' assembly.

### 7. Analytics Enhancements
- **Semantic layer** — governed dimensions and measures so that self-service exploration cannot produce contradictory numbers.
- **Cohort and segment analysis** — by estate age, unit count, region, contract type, management tenure.
- **Statistical rigour** — seasonality decomposition on collection, outlier handling, small-sample warnings.
- **Data quality monitoring** — completeness, freshness and consistency checks surfaced as first-class metrics, because analytics adoption dies the first time leadership catches a wrong number.

### 8. Automation Enhancements
- **Threshold alerts** — any KPI crossing a defined boundary triggers a V24 workflow automatically.
- **Automated variance investigation** — a metric breach opens a task assigned to the metric owner with the relevant analysis attached.
- **Scheduled board pack assembly and distribution.**

### 9. Administrator Features
- KPI governance: definition approval, ownership assignment, change history.
- Analytics permissions down to row level (an estate manager sees only their estates, in every analytical view).
- Refresh scheduling and load management for heavy queries.
- Usage analytics on the analytics itself — which reports are actually opened, so the catalogue can be pruned rather than endlessly grown.

### 10. Executive Features
This is the release's purpose, and the entire section is the feature: a portfolio-level view that answers, in one screen, *are we collecting, are we spending appropriately, are our buildings being maintained, are residents satisfied, what is at risk, and what needs my decision today* — with every number traceable to its source and every exception one click from the person accountable for it.

### 11. Mobile Improvements
- **Executive mobile experience** — the executive dashboard designed phone-first, because this audience reads it in a car, not at a desk.
- Swipeable KPI cards, tap-to-drill, share-to-WhatsApp of any chart as an image with figures rendered legibly.
- Offline snapshot of the last generated board pack.

### 12. Security Improvements
- Row and column level security enforced in the semantic layer, not in the UI.
- Sensitive financial metrics restricted by role with explicit grant, not by obscurity.
- Watermarked exports carrying recipient identity, deterring uncontrolled circulation of financial data.
- Export audit — who exported which dataset, when.

### 13. Performance Improvements
- Pre-aggregated cubes for common portfolio queries; sub-second executive dashboard load at 150 estates.
- Incremental materialisation rather than full recomputation.
- Query governor with cost limits and a queue for heavy self-service analyses.
- Separate read replica so analytical load never degrades operational responsiveness.

### 14. Business Value
Executive visibility shortens the distance between a problem appearing and someone deciding about it — the single largest source of avoidable cost in multi-estate management. Benchmarking turns 150 estates from a reporting burden into a comparative advantage. And a credible board reporting pack is frequently the deciding factor when a management company wins or loses a portfolio contract.

### 15. Why this release exists
Because operational excellence that leadership cannot see does not get funded. V26 makes the value created by V23–V25 legible to the people who renew the contract, and it establishes the governed metric layer that V28, V33 and V34 all depend on.

**Preserved from V22:** the operational dashboard, its four stat cards, its chart, its widgets and its filter chips remain the default landing experience for every non-executive role.
**Non-goals:** no replacement of the operational dashboard, no forced migration of any user to the executive view.

---

# VERSION 27 — Asset & Risk Operations

*Train theme: the platform learns what the buildings are made of.*

### 1. Release Vision
Until now the product manages work. V27 makes it manage **things**: elevators, generators, boilers, hydrophores, pumps, fire systems, pool equipment, CCTV, playgrounds, HVAC, and the thousands of items on a site's demirbaş register. Once assets exist as records with history, cost and condition, maintenance stops being reactive, risk becomes quantifiable, and incidents get a proper command surface.

### 2. New Enterprise Features
- **Asset Management / Demirbaş ve Varlık Yönetimi** — full register with hierarchy (Site → Blok → Sistem → Ekipman → Parça), specification, supplier, warranty, install date, expected life, book value and location on the existing Site Haritası.
- **Maintenance Intelligence / Bakım Zekası** — condition-based and predictive maintenance planning replacing pure calendar scheduling, with per-asset failure history and cost-to-maintain vs. cost-to-replace analysis.
- **Risk Management / Risk Yönetimi** — a risk register per estate with likelihood, impact, mitigation owner, review date and a portfolio heat map. Covers physical, financial, legal, compliance and reputational risk.
- **Incident Center / Olay Merkezi** — severity-classified incident lifecycle: detection, triage, response, resolution, post-incident review. Built for water ingress, lift entrapment, fire alarm activation, power loss, security events and injuries.
- **Compliance Calendar / Mevzuat Takvimi** — statutory inspection and certification tracking: asansör periyodik kontrol and its label grade, yangın tüpü and tesisat kontrolü, jeneratör and paratoner tests, pool water analysis, insurance and licence expiry — each with owner, evidence upload and escalation.
- **Contractor Management / Tedarikçi Yönetimi** — contractor records, contract terms, insurance and certification validity, rate cards, and a performance score built on V24's SLA data.
- **Warranty & lifecycle tracking** — warranty expiry alerts and replacement planning feeding V28's capital forecasting.

### 3. UX Improvements
- **Asset detail as a timeline** — every intervention, cost, document, photo and inspection in one chronological record.
- **Site Haritası becomes interactive** — the V22 block map keeps its exact visual treatment and gains asset overlays, status colouring from the existing semantic ramp, and click-through to asset records.
- **QR code scanning** — every asset carries a QR label; scanning opens the asset on mobile, ready for a log entry.
- **Photo-centric documentation** — before/after capture as a first-class pattern on every intervention.
- **Severity is unmistakable** — incident severity uses one consistent visual language across list, detail, notification and dashboard.

### 4. Dashboard Enhancements
- New widgets: Asset Health, Upcoming Inspections, Compliance Status, Open Incidents by Severity, Maintenance Backlog, Contractor Performance.
- **Compliance countdown** — a permanently visible card showing statutory deadlines inside 30 days; the single most legally consequential widget in the product.
- Existing "Açık İş Emri" widget gains an asset-linked breakdown without changing its composition.

### 5. AI Enhancements
- **Failure prediction** — per-asset probability of failure in the next 30/60/90 days from age, service history, usage proxies and comparable assets across the portfolio.
- **Maintenance optimisation** — recommended intervals per asset class based on observed portfolio outcomes rather than manufacturer defaults.
- **Incident pattern recognition** — recurring root causes surfaced across estates ("six water incidents this quarter, all in buildings with the same 2011-era riser system").
- **Photo-based triage** — image classification suggests category, severity and likely trade from a resident's photograph.
- **Contract intelligence** — obligations, penalties and renewal dates extracted from uploaded contractor agreements.

### 6. Reporting Enhancements
- Asset register report with book value and depreciation, formatted for denetçi and owners' assembly presentation.
- Maintenance history report per asset, per estate, per contractor.
- Compliance status report — inspection currency evidence, exportable as a single audit pack.
- Incident report with full timeline, actions and post-incident findings.
- Total cost of ownership report per asset class.

### 7. Analytics Enhancements
- **Reliability analytics** — mean time between failures and mean time to repair by asset class and by contractor.
- **Cost-per-asset trending**, revealing the point at which maintenance exceeds replacement economics.
- **Risk exposure scoring** rolled up to portfolio level.
- **Contractor comparative analysis** — cost, speed, first-time-fix and rework, side by side.

### 8. Automation Enhancements
- Automatic work-order generation from predicted failures and inspection due dates, with lead time appropriate to procurement.
- Escalation ladders by incident severity, including out-of-hours on-call routing.
- Compliance escalation — approaching statutory deadlines escalate automatically to the yönetici and then to the portfolio manager.
- Automatic contractor dispatch for defined categories, within pre-approved rate and value limits.
- Warranty claim prompts when a failure occurs on an in-warranty asset — a direct, measurable cost recovery.

### 9. Administrator Features
- Asset taxonomy and category management, with import from existing demirbaş spreadsheets.
- Maintenance policy configuration per asset class and per estate.
- Risk matrix configuration (likelihood/impact scales and thresholds).
- Incident severity definitions and their corresponding response protocols.
- Contractor onboarding with document verification and expiry enforcement.

### 10. Executive Features
- **Portfolio risk heat map** — every estate scored, ranked and drillable.
- **Capital planning view** — assets approaching end of life across the portfolio, with projected replacement cost by year, feeding directly into V28.
- **Compliance assurance dashboard** — a single answer to "are we legally exposed anywhere," which is precisely the question a management company's leadership loses sleep over.
- **Incident executive brief** — automatic notification with full context for severity-1 events.

### 11. Mobile Improvements
- **Field-first asset workflows** — scan, inspect, log, photograph, sign off, all on a phone, with large touch targets and glove-friendly spacing.
- Digital inspection checklists with mandatory evidence capture.
- Incident reporting from mobile with location, photo and severity in under 30 seconds.
- Offline capture queued for sync — the architectural groundwork completed in V30.

### 12. Security Improvements
- Chain-of-custody on inspection evidence: immutable timestamps, capture-device metadata, tamper-evident storage.
- Restricted access to security-sensitive asset data (CCTV, access control, alarm configuration).
- Contractor access scoping — external users see only their own assigned work and nothing else.
- Incident data retention aligned to legal and insurance requirements.

### 13. Performance Improvements
- Efficient handling of large photo and document volumes: client-side compression, progressive upload, CDN delivery, lazy loading.
- Spatial indexing for map queries.
- Time-series storage for sensor and reading data, ready for IoT ingestion in V33.
- Background processing of image classification so field workflows never block.

### 14. Business Value
Unplanned failures fall as prediction replaces reaction; emergency call-out premiums — the most expensive money in facilities management — drop accordingly. Asset life extends under condition-based maintenance. Warranty recovery becomes systematic. Statutory compliance becomes provable rather than assumed, materially reducing legal and insurance exposure. And contractor performance data shifts negotiating power to the management company at every renewal.

### 15. Why this release exists
Because a building management platform that does not know what is in the buildings is a scheduling tool. V27 is where BN Yönetim becomes genuinely domain-deep — and it must precede V28, because credible financial forecasting for an estate is impossible without knowing which assets are about to need replacing.

**Preserved from V22:** the Site Haritası view keeps its block/daire card layout exactly; asset capability is layered on as overlays and drill-downs.
**Non-goals:** no IoT sensor hardware programme in this release; no BIM integration (deferred to V33's Digital Twin).

---

# VERSION 28 — Financial Intelligence

*Train theme: from recording money to understanding money.*

### 1. Release Vision
V22's collection chart and %94 collection-rate widget are the visible tip of the domain's real centre of gravity: the aidat cycle, the işletme projesi, the reserve fund, arrears and enforcement, and the annual reckoning at the kat malikleri kurulu. V28 builds the full financial intelligence layer beneath what V22 already shows — budgeting, forecasting, cash flow, expense analysis and arrears management — with Turkish statutory and banking realities designed in, not bolted on.

### 2. New Enterprise Features
- **Financial Analytics / Finansal Analitik** — income and expenditure analysed by estate, category, period, block and unit type, against budget.
- **Budget Forecast / Bütçe ve Tahmin** — the işletme projesi as a first-class product object: annual operating budget construction, per-unit dues derivation by arsa payı or equal share, board approval workflow through V24, and continuous actual-vs-budget variance tracking.
- **Cash Flow Dashboard / Nakit Akış Panosu** — 13-week rolling cash view per estate and consolidated across the portfolio, with reserve fund (demirbaş/yenileme fonu) separation.
- **Expense Intelligence / Gider Zekası** — categorised expenditure with anomaly detection, duplicate-invoice detection, price benchmarking across estates and supplier concentration analysis.
- **Arrears Management / Alacak Takibi** — ageing buckets, statutory late-payment interest calculation, staged reminder ladders, payment plan agreements, and structured handover to icra takibi with a full evidence pack.
- **Payment & banking layer** — virtual POS and card payment, bank statement import and automatic reconciliation by IBAN and reference code, DBS/automatic payment enrolment, and per-unit payment history.
- **e-Document integration** — e-Fatura / e-Arşiv / e-Makbuz issuance and archiving, and supplier invoice intake with matching against work orders and purchase approvals.

### 3. UX Improvements
- **Financial clarity standards** — tabular numerals (already a V22 token) enforced everywhere, consistent ₺ formatting, negative values in one unambiguous treatment, and an explicit "as of" timestamp on every financial figure.
- **Unit financial card** — one screen showing a unit's entire position: charges, payments, balance, interest, agreements, correspondence and documents.
- **Budget builder** — a spreadsheet-familiar grid inside the V22 table component, so finance users are not forced to abandon a mental model that works.
- **Reconciliation workspace** — a two-column matching interface with confidence-ranked suggestions and one-click confirmation.
- **Payment experience for residents** — three taps from notification to paid, no login friction, no account creation requirement.

### 4. Dashboard Enhancements
- The V22 Aylık Aidat Tahsilatı chart is preserved and gains budget line, prior-year overlay and forecast continuation.
- The %94 Tahsilat Oranı widget is preserved and gains trend, target and drill-through to the arrears list.
- New widgets: Cash Position, Budget Variance, Ageing Summary, Reserve Fund Level, Expense vs. Budget by Category, Upcoming Payment Obligations.
- **Collection funnel** — charged → notified → paid → overdue → in enforcement, visible in one glance.

### 5. AI Enhancements
- **Collection forecasting** at unit level, aggregated to estate and portfolio, with confidence bands.
- **Payment behaviour segmentation** — reliable, occasionally late, chronically overdue, at-risk — driving proportionate and humane reminder strategies rather than uniform pressure.
- **Invoice anomaly detection** — price deviation, duplicate submission, out-of-scope items, suspicious timing.
- **Budget assistance** — draft next year's işletme projesi from actuals, known contracts, asset replacement schedules from V27 and inflation assumptions.
- **Narrative financial commentary** on every statement, explaining variance in plain Turkish.

### 6. Reporting Enhancements
- The full statutory and governance pack: gelir-gider tablosu, işletme projesi vs. gerçekleşme, borç-alacak listesi, kasa ve banka raporu, denetçi raporu ekleri.
- Per-unit statements (hesap ekstresi) generated and distributed in bulk, in-product and by e-mail.
- Contractor and supplier spend reports.
- Reserve fund movement report.
- Year-end closing pack assembled automatically for the annual assembly.

### 7. Analytics Enhancements
- **Cost per unit / per m² benchmarking** across the portfolio, normalised for estate size and facility type.
- **Seasonality modelling** on both income and expenditure (heating season, pool season, landscaping cycles).
- **Arrears cohort analysis** — how quickly each cohort of debt is recovered, and which interventions actually work.
- **Supplier price trend analysis** with negotiation leverage indicators.
- **Break-even and sensitivity analysis** on dues levels.

### 8. Automation Enhancements
- Automatic dues generation on the estate's billing calendar, with correct per-unit apportionment.
- Automatic payment matching and receipt issuance.
- Statutory interest accrual on overdue balances, calculated correctly and consistently.
- Staged, automated arrears escalation with legally appropriate notice content and delivery evidence.
- Budget threshold alerts that open V24 approval workflows before overspend occurs, not after.
- Recurring supplier payment scheduling.

### 9. Administrator Features
- Chart of accounts management per estate, with portfolio-level standard templates.
- Dues apportionment rule configuration (equal, arsa payı, m², unit type, mixed).
- Bank account and POS configuration with reconciliation rules.
- Financial period locking and controlled reopening, with audit.
- Approval thresholds per estate and per category.
- Fiscal calendar and assembly date management.

### 10. Executive Features
- **Consolidated portfolio financial position** across all managed estates.
- **Collection performance league table** by estate and by manager.
- **Cash risk early warning** — estates projected to be unable to meet obligations within 90 days.
- **Management company P&L view** — the management company's own commercial performance per contract, separate from estate funds and strictly access-controlled.

### 11. Mobile Improvements
- Resident mobile payment with saved cards, recurring payment setup and instant receipt.
- Mobile balance enquiry and statement download.
- Executive mobile financial summary with drill-through.
- Mobile expense capture: photograph a receipt, categorise, submit for approval.

### 12. Security Improvements
- PCI-DSS-compliant payment handling; no card data ever touches BN Yönetim infrastructure.
- Strict segregation of duties on financial transactions, enforced by the V24 approval engine.
- Dual authorisation for payments above configurable thresholds.
- Immutable financial audit trail with cryptographic integrity verification.
- Encryption at rest for all financial and banking records; strict role-based access to unit-level financial data.
- Fraud detection on unusual payment patterns and account-detail changes.

### 13. Performance Improvements
- Optimised handling of high-volume transaction data — a 25.000-resident portfolio generates hundreds of thousands of financial records annually.
- Materialised balance calculations rather than on-demand aggregation of full ledgers.
- Batch processing for bulk dues generation and statement distribution.
- Payment gateway resilience with retry, idempotency keys and reconciliation of in-flight transactions.

### 14. Business Value
Collection rate improvement is the single highest-leverage metric in this domain: a two-point gain across a 25.000-unit portfolio is a very large sum, and it flows directly to estate liquidity. Automated reconciliation eliminates the most tedious recurring labour in estate accounting. Expense intelligence recovers money quietly lost to duplicate invoicing and price drift. And a defensible financial record materially strengthens the management company's position at every kat malikleri kurulu.

### 15. Why this release exists
Because money is why estate management exists as a profession, and because everything needed to do it well is now in place: workflows to enforce approval (V24), AI to forecast (V25), governed metrics to report (V26) and asset data to plan capital spending (V27). V28 is the release the customer's finance function has been waiting for since V22.

**Preserved from V22:** the collection chart and the %94 collection-rate widget keep their exact form and become the entry points into the new financial depth.
**Non-goals:** BN Yönetim does not become a general-ledger accounting system; it integrates with the customer's accounting software rather than replacing it.

---

# VERSION 29 — Community & Communication

*Train theme: the 25.000 residents stop being a number on a stat card.*

### 1. Release Vision
V22 counts residents. V29 gives them a product. Every capability so far has served the people who manage estates; this release serves the people who live in them, and the boards that represent them — because resident satisfaction is the renewal metric, and because a resident who can self-serve is a resident who does not generate a phone call.

### 2. New Enterprise Features
- **Communication Center / İletişim Merkezi** — unified, multi-channel communication (in-app, e-mail, SMS, WhatsApp) with templates, audience segmentation, scheduling, delivery tracking and full history against each resident record.
- **Resident Portal / Sakin Portalı** — dues balance and payment, fault reporting with photo, request tracking, document access (yönetim planı, karar defteri, duyurular), facility booking, visitor pre-registration and contact directory.
- **Announcement Center / Duyuru Merkezi** — targeted announcements by estate, block, floor, unit type or resident status, with read receipts, pinning, expiry and mandatory-acknowledgement for legal notices.
- **Survey Module / Anket Modülü** — satisfaction surveys, decision consultations and NPS tracking, with anonymity options and result analytics.
- **Assembly Support / Genel Kurul Desteği** — meeting notice distribution with legal delivery evidence, agenda publication, proxy (vekaletname) registration, attendance and quorum tracking, digital voting where the yönetim planı permits, and minute distribution.
- **Facility Booking / Ortak Alan Rezervasyonu** — meeting rooms, sports facilities, pools and social areas with rules, quotas and fees.
- **Resident directory and household management** — owner vs. tenant distinction, household members, contact preferences, move-in/move-out workflows.

### 3. UX Improvements
- **Resident-grade simplicity** — the portal is built entirely from V22 components but designed for someone who will use it four times a year and has never been trained.
- **Zero-training fault reporting** — photograph, describe in one line, submit; category and location inferred by AI, editable.
- **Transparent request tracking** — the resident sees the same stage timeline the operator sees, which is the single most effective complaint-reduction feature in this domain.
- **Communication preference centre** — channel and frequency control per resident, respecting both preference and KVKK consent.
- **Accessibility emphasis** — the resident population includes elderly users; larger default type option, high-contrast mode and full screen-reader support are mandatory here, not optional.
- Full Turkish and English resident experience, with the existing TR|EN pattern from the V22 top bar.

### 4. Dashboard Enhancements
- New operator widgets: Resident Satisfaction Index, Open Resident Requests, Announcement Reach, Survey Response Rate, Portal Adoption, Communication Volume by Channel.
- The V22 "Toplam Sakin 25.000+" stat card is preserved and gains active-portal-user and satisfaction drill-through.
- **Sentiment trend** per estate, sourced from requests, comments and surveys.

### 5. AI Enhancements
- **Resident assistant** — a resident-facing conversational agent answering balance, procedure, rule and status questions in natural Turkish, escalating to a human when uncertain, and never disclosing another household's data.
- **Auto-categorisation and routing** of resident requests.
- **Tone assistance** on announcements — drafts that are clear, correct and appropriately formal, in both languages.
- **Complaint theme clustering** — recurring resident concerns surfaced to management before they reach the assembly floor.
- **Survey response summarisation** including free-text themes.

### 6. Reporting Enhancements
- Resident satisfaction report with trend and segment breakdown.
- Communication effectiveness report — reach, open, acknowledgement, by channel and audience.
- Request volume and resolution report by category and estate.
- Assembly report pack: notice delivery evidence, attendance, quorum, votes, resolutions.
- Portal adoption report per estate.

### 7. Analytics Enhancements
- **Satisfaction driver analysis** — which operational metrics actually correlate with resident sentiment (typically response time far more than resolution cost).
- **Channel effectiveness** by resident demographic, informing communication strategy per estate.
- **Request seasonality** for staffing and capacity planning.
- **Estate community health index** combining satisfaction, participation, complaint volume and payment behaviour.

### 8. Automation Enhancements
- Automated acknowledgement and status updates on every resident request — closing the loop that generates most follow-up calls.
- Scheduled recurring communications (monthly dues notice, seasonal reminders, maintenance disruption notices).
- Automatic notification of residents affected by a work order in their block, generated from the V24 workflow.
- Assembly notice sequences with statutory timing and delivery evidence.
- Post-resolution satisfaction survey triggered automatically on closure.
- Move-in / move-out checklists driving account setup, access provisioning and final settlement.

### 9. Administrator Features
- Portal configuration per estate: enabled features, branding fields, house rules content, document library.
- Communication template library with approval workflow for legally sensitive content.
- Audience segment builder.
- Resident data governance: consent capture, preference management, retention and erasure handling under KVKK.
- Moderation controls for any resident-visible content.

### 10. Executive Features
- **Portfolio satisfaction dashboard** — every estate ranked, with movement.
- **Escalation visibility** — resident issues that have reached complaint or legal threshold anywhere in the portfolio.
- **Retention risk indicator** — estates whose resident sentiment predicts a contested management renewal.
- **Community engagement benchmarking** across the portfolio.

### 11. Mobile Improvements
- The resident experience is designed mobile-first; this is the audience that will never open a desktop browser.
- Push notification for announcements, request updates and payment reminders.
- One-tap payment from a dues notification.
- Photo-first fault reporting.
- Home-screen installable progressive web app ahead of the native experience in V30.

### 12. Security Improvements
- Strict household data isolation — a resident sees their own unit and nothing else, enforced at the data layer.
- Secure resident identity verification at enrolment (unit-linked invitation codes, no self-asserted membership).
- Full KVKK compliance for resident personal data: explicit consent, purpose limitation, aydınlatma metni, data subject access and erasure workflows, VERBİS records.
- Anonymity guarantees on surveys, technically enforced and independently verifiable.
- Anti-abuse controls on resident-submitted content and on communication volume.

### 13. Performance Improvements
- Architecture sized for a different order of magnitude: 25.000+ concurrent-capable resident users versus hundreds of staff users.
- Communication fan-out through a queued, rate-limited delivery service protecting sender reputation.
- Aggressive caching of resident-facing read paths; portal load target under 1.5s on 4G.
- Lightweight portal bundle — the resident portal must not carry the operational application's payload.

### 14. Business Value
Inbound call and message volume falls sharply as self-service replaces enquiry — typically the largest single labour cost in estate administration. Payment convenience directly improves collection. Documented, evidenced communication protects the management company in disputes. And satisfaction data converts contract renewal from a political negotiation into an evidence-based one.

### 15. Why this release exists
Because a management company's contract is renewed by residents and boards, not by operators — and because by V29 the platform finally has something worth showing them: real request tracking (V24), real answers (V25), real financial transparency (V28) and real maintenance evidence (V27).

**Preserved from V22:** the entire operator experience is untouched; the resident portal is an additional surface built from the same design system.
**Non-goals:** no social network features; no resident-to-resident messaging (a moderation liability disproportionate to its value).

---

# VERSION 30 — Enterprise Mobile & Field Operations

*Train theme: the platform follows the work outside, where the work actually is.*

### 1. Release Vision
Every release so far has been responsive. V30 is different in kind: it delivers native mobile applications, true offline capability, real push infrastructure and a field operations model designed for the technician standing in a basement with no signal. The web application remains the complete product; mobile becomes the complete product *for the people who are never at a desk*.

### 2. New Enterprise Features
- **Enterprise Mobile Experience / Kurumsal Mobil Uygulama** — native iOS and Android applications for staff, plus the resident application, sharing the V22 design system through a mobile-native token implementation.
- **Offline Mode / Çevrimdışı Mod** — full read and write capability without connectivity: assigned work orders, asset records, checklists, resident contacts and documents cached locally; all actions queued and synchronised with conflict resolution on reconnection.
- **Push Notifications / Anlık Bildirimler** — real delivery infrastructure for the V24 notification engine, with categories, priority channels, quiet hours, rich actionable notifications and deep linking.
- **Field Operations / Saha Operasyonları** — the technician's day: route-optimised job list, travel and time tracking, parts and consumables recording, digital signature capture, before/after photo requirements, and immediate closure from site.
- **Mobile inspection module** — statutory and routine inspection checklists with mandatory evidence, offline capable, producing compliance-grade records.
- **Geolocation features** — check-in verification at the estate, nearest-technician dispatch and travel time analytics.
- **Contractor mobile access** — a restricted application surface for external contractors covering only their assigned work.

### 3. UX Improvements
- **Designed for the actual conditions**: gloves, bright sunlight, one hand, poor signal, cheap Android hardware. Large targets, high contrast mode, minimal typing, aggressive use of camera and voice.
- **Offline state honesty** — the user always knows what is cached, what is queued and what has synced; never a silent failure.
- **Task-focused mobile navigation** — the staff app opens on today's work, not on a dashboard.
- **Camera-first workflows** throughout.
- **Voice input** for notes and descriptions, using the V25 copilot.
- **Battery and data awareness** — configurable sync behaviour and image quality on metered connections.

### 4. Dashboard Enhancements
- **Field operations dashboard** for supervisors: live technician status, jobs in progress, jobs at risk, travel time, first-time-fix rate.
- New widgets: Team Location Overview, Jobs Completed Today, Average On-Site Time, Sync Health, Mobile Adoption.
- All V22 dashboard widgets receive a mobile card treatment preserving their exact content and hierarchy.

### 5. AI Enhancements
- **On-device intelligence** — offline-capable photo classification and form pre-fill.
- **Route and schedule optimisation** across technicians, jobs, skills, parts availability and SLA deadlines.
- **Voice-to-work-order** — a spoken account of the job becomes a structured, categorised record.
- **Field guidance** — asset history, manuals, prior fixes and recommended procedure surfaced automatically when a technician opens a job.
- **Predictive dispatch** — anticipated demand used to pre-position staff.

### 6. Reporting Enhancements
- Field productivity reporting: jobs per technician per day, travel vs. wrench time, first-time-fix rate.
- Mobile-generated evidence packs — inspection reports with photos and signatures, produced automatically as PDFs.
- Time and attendance reporting from geolocated check-ins, feeding puantaj and payroll.
- Mobile adoption and offline usage reporting.

### 7. Analytics Enhancements
- **Travel time analysis** across the portfolio, quantifying the cost of estate geography and informing territory design.
- **Productivity benchmarking** by technician, team and estate, with appropriate fairness safeguards on how such data may be used.
- **Response time analysis** by time of day, day of week and season.
- **Parts consumption analytics** driving inventory optimisation.

### 8. Automation Enhancements
- Automatic dispatch on job creation using skills, location, load and SLA.
- Automatic resident notification when a technician is en route and on completion.
- Automatic timesheet generation from field activity.
- Automatic escalation when a job exceeds expected duration.
- Background sync with intelligent scheduling on connectivity restoration.

### 9. Administrator Features
- Mobile device management integration and remote wipe for lost devices.
- Mobile-specific permission profiles.
- Offline data scope configuration — what each role caches and for how long.
- App version management with forced-update policy for security releases.
- Geofence configuration per estate.

### 10. Executive Features
- **Executive mobile app** — the V26 executive dashboard and V24 approval queue, native and offline-capable.
- **Portfolio field operations overview** — where the workforce is and what it is achieving, portfolio-wide.
- **Mobile approval with full context**, including the ability to approve while abroad or in transit.

### 11. Mobile Improvements
The entire release is this section. Additionally: biometric authentication, app-level privacy screen, widget support on both platforms, wearable notifications, deep linking from every notification, and full accessibility support in both native applications (VoiceOver and TalkBack).

### 12. Security Improvements
- Certificate pinning and encrypted local storage for all cached data.
- Biometric authentication with device-level enforcement.
- Remote wipe and session revocation.
- Jailbreak/root detection with policy-driven response.
- Offline data expiry — cached data self-destructs after a configurable window without contact with the server.
- Location data handled under explicit consent with a clear, honest purpose statement to staff.

### 13. Performance Improvements
- Native performance targets: cold start under 2s, list scroll at 60fps on mid-range Android hardware.
- Delta sync — only changed records transferred.
- Image pipeline: on-device compression before upload, resumable transfer.
- Battery profile validated across a full working day of continuous use.
- Sub-100MB app footprint.

### 14. Business Value
Field productivity rises through routing and elimination of paperwork return trips. Data quality improves dramatically because records are created at the point of work rather than reconstructed at the end of the day. Offline capability removes the single most common excuse for incomplete records. Response times fall, which is the operational metric most strongly correlated with resident satisfaction (V29).

### 15. Why this release exists
Because in facilities management most of the work happens in basements, on roofs and in plant rooms — and until V30 the platform stops at the office door. It comes at this point in the roadmap because native mobile is only worth building once the workflows (V24), assets (V27) and field-relevant intelligence (V25, V27) exist to put in it.

**Preserved from V22:** the web application remains complete and primary; the V22 mobile menu and responsive layouts continue to serve browser users on phones.
**Non-goals:** no feature is made mobile-exclusive; the web application never becomes the lesser experience.

---

# VERSION 31 — Platform & Ecosystem

*Train theme: BN Yönetim stops being a product and becomes a platform.*

### 1. Release Vision
Nine releases of depth have made the product broad; V31 makes it extensible. Rather than absorbing every possible integration and vertical requirement into the core roadmap, V31 opens the platform: a public API, a plugin system, a marketplace and a developer portal. The product's surface stops being limited by BN Yönetim's own engineering capacity.

### 2. New Enterprise Features
- **API Center / API Merkezi** — a complete, versioned public REST API plus webhooks and a GraphQL query layer, covering every entity from V22 through V30, with OAuth 2.0, scoped tokens, rate limits and sandbox environments.
- **Plugin System / Eklenti Sistemi** — a sandboxed extension model with defined extension points: custom dashboard widgets, custom report types, workflow actions, data enrichment, custom fields and embedded views. Plugins are declaratively styled by the V22 design system, so third-party extensions cannot visually fracture the product.
- **Marketplace / Uygulama Mağazası** — discovery, one-click installation, per-tenant configuration, versioning, permission disclosure, ratings and commercial billing for partner solutions.
- **Developer Portal / Geliştirici Portalı** — documentation, interactive API explorer, SDKs (JavaScript, Python, .NET), sample applications, sandbox tenants, changelog and certification programme.
- **Integration library** — first-party connectors for Turkish banking (statement and DBS), GİB e-Fatura providers, accounting packages (Logo, Mikro, Netsis), payment providers, SMS and WhatsApp Business, calendar and identity providers (SAML/OIDC SSO), and IoT gateways for metering.
- **Custom fields and objects** — tenant-defined fields on core entities and lightweight custom objects, available throughout reporting, automation and API without engineering involvement.

### 3. UX Improvements
- **Marketplace browsing** that looks and behaves like the rest of the product — same cards, same glass surfaces, same typography.
- **Transparent permission consent** — before installation, exactly what data a plugin can reach, in plain Turkish.
- **Seamless plugin surfacing** — an installed widget looks identical to a first-party widget; a badge indicates provenance without visual disruption.
- **Developer experience quality** — an API explorer with real responses and copy-ready code samples.

### 4. Dashboard Enhancements
- Third-party widgets install directly into the V23 widget framework.
- New widgets: Integration Health, API Usage, Installed Extensions, Sync Status by Connector.
- **Data from anywhere** — dashboards can now display metrics originating from connected external systems as first-class KPI cards.

### 5. AI Enhancements
- **AI over integrated data** — the copilot can answer questions spanning BN Yönetim and connected systems.
- **AI-assisted integration mapping** — field mapping between systems proposed automatically.
- **Plugin-extensible AI** — partners can register tools the copilot may invoke, under strict permission and audit control.
- **API usage anomaly detection** as a security signal.

### 6. Reporting Enhancements
- Reports over combined internal and integrated data.
- Custom report types delivered by plugins.
- Report API for embedding BN Yönetim reporting in customer intranets and portals.
- White-label report branding for management companies serving their own clients.

### 7. Analytics Enhancements
- **Analytics data export API** for customers with their own data warehouses.
- **Embedded analytics** — secure iframe and component embedding of any dashboard.
- **Cross-system analysis** joining platform data with accounting and banking data.
- Marketplace analytics for partners (usage, retention, revenue).

### 8. Automation Enhancements
- **External triggers and actions** — V24 automations can now be triggered by external events and can invoke external systems.
- **Webhook subscriptions** on every meaningful platform event.
- **Two-way sync** with defined conflict resolution for integrated systems.
- **Automation templates in the marketplace**, shareable between customers.

### 9. Administrator Features
- Extension governance: allow-lists, approval requirements, per-plugin permission review and blocking.
- API key and token lifecycle management with per-integration scoping and rotation.
- Integration monitoring with failure alerting and replay of failed events.
- Sandbox tenant provisioning for customer development teams.
- Extension cost visibility.

### 10. Executive Features
- **Ecosystem value view** — which integrations and extensions are actually used and what they contribute.
- **Vendor consolidation analysis** — which external tools the platform now makes redundant, a direct cost argument.
- **Partner strategy view** for BN Yönetim's own leadership: marketplace revenue, partner activity, ecosystem growth.

### 11. Mobile Improvements
- Mobile SDK allowing plugin surfaces inside the native applications.
- Deep linking into third-party applications from BN Yönetim mobile.
- Mobile-capable OAuth flows for connected services.

### 12. Security Improvements
- Plugin sandboxing with strict resource and data isolation; no plugin can reach data outside its granted scope.
- Mandatory security review and code signing in the certification process.
- API security: OAuth 2.0, granular scopes, rate limiting, IP allow-listing, request signing, comprehensive access logging.
- Enterprise SSO (SAML 2.0 / OIDC) with SCIM user provisioning.
- Full data processing transparency for every connected third party, satisfying KVKK obligations on data sharing.

### 13. Performance Improvements
- API gateway with intelligent caching, per-tenant rate limits and fair-use enforcement.
- Plugin execution isolation so a badly written extension cannot degrade the host application.
- Asynchronous integration processing with backpressure handling.
- Bulk API endpoints for high-volume operations.

### 14. Business Value
Enterprise deals that previously stalled on a single missing integration now close. Implementation time falls because customers extend rather than request. The marketplace creates a new revenue stream and, more importantly, raises switching costs materially: a customer with six installed extensions and two custom integrations does not migrate to a competitor.

### 15. Why this release exists
Because at 150 estates and 25.000 residents the product has enough gravity to sustain an ecosystem, and because no single roadmap can serve every customer's specific requirements. V31 converts BN Yönetim from a product that must anticipate every need into a platform on which needs are met by others.

**Preserved from V22:** every native capability continues to work identically with zero extensions installed.
**Non-goals:** no plugin may modify the core design system, override V22 tokens, or alter core navigation.

---

# VERSION 32 — AI Automation & Autonomy

*Train theme: the platform begins to run itself, under supervision.*

### 1. Release Vision
V24 automated rules a human wrote. V25 gave humans an assistant. V32 closes the loop: an automation centre where AI proposes, designs, monitors and — within explicit, bounded, revocable authority — executes. This is the most governance-heavy release in the roadmap, and deliberately arrives late, after eight releases of audit trails, permissions, process data and demonstrated AI reliability have earned the right to it.

### 2. New Enterprise Features
- **AI Automation Center / Yapay Zeka Otomasyon Merkezi** — a single console for every automated behaviour in the platform: what runs, how often, what it costs, what it saves, what it got wrong.
- **Workflow Designer / İş Akışı Tasarımcısı** — a full visual process designer with branching, parallel paths, sub-processes, timers, compensation paths, simulation against historical data and versioned deployment. The V24 rule builder is preserved for simple cases.
- **Business Rule Engine / İş Kuralları Motoru** — centralised, testable, versioned business logic: dues apportionment rules, approval thresholds, escalation policies, SLA definitions, eligibility rules — editable by business users without deployment.
- **AI Recommendations / Yapay Zeka Önerileri** — continuous recommendation of process improvements, automation opportunities, cost reductions and risk mitigations, each with quantified expected impact and one-click trial.
- **Autonomous agents / Otonom Ajanlar** — bounded agents operating within explicit authority: schedule preventive maintenance within budget, chase overdue payments through the approved ladder, dispatch routine work orders, prepare reports. Every agent has a written scope, a spending limit, a supervisor and a kill switch.
- **Process mining** — automatic discovery of how work actually flows versus how it was designed to flow.

### 3. UX Improvements
- **Authority is visible, always** — every autonomous action is labelled, attributed to its agent, and reversible. Users never wonder whether a person or a system did something.
- **Approval gradient** — each automation is configured on a spectrum: suggest only → draft and hold → execute and notify → execute silently. The default is always the most conservative.
- **Simulation before activation** — every new automation is run against the last 12 months of data and its would-have-been actions are reviewed before it is allowed to act.
- **Intervention affordance** — a persistent, one-tap way to stop, pause or reverse any automated behaviour.
- **Automation transparency feed** — a plain-language log of everything the system did on the user's behalf.

### 4. Dashboard Enhancements
- New widgets: Automation Coverage, Hours Saved, Agent Activity, Exceptions Requiring Human Judgement, Automation Accuracy, Cost of Automation.
- **Exception-only operational dashboard mode** — when automation handles the routine, the dashboard shows only what it could not handle, which is a profound change in how the operator's day is shaped.

### 5. AI Enhancements
- **Multi-step reasoning** across systems and time horizons.
- **Learning from correction** — every human override becomes training signal for rule refinement, with changes proposed rather than applied silently.
- **Confidence-based routing** — high-confidence cases automated, low-confidence cases routed to humans, thresholds tuned per process and per tenant.
- **Continuous optimisation** of maintenance intervals, reminder timing, staffing levels and routing.
- **Model performance monitoring** with drift detection and automatic fallback to conservative behaviour.

### 6. Reporting Enhancements
- Automation performance reporting: volume, accuracy, exception rate, override rate, value delivered.
- Fully autonomous report generation, distribution and follow-up on unread critical reports.
- Process conformance reporting from process mining.
- AI decision audit reports, formatted for regulatory and denetçi review.

### 7. Analytics Enhancements
- **Process mining analytics** — actual paths, variants, bottlenecks, rework loops and their cost.
- **Automation opportunity scoring** — every repetitive human action ranked by automation value.
- **Counterfactual analysis** — measured impact of automation against a held-out control, so claimed savings are evidenced rather than asserted.
- **Decision quality analysis** comparing automated and human outcomes on comparable cases.

### 8. Automation Enhancements
The release's core. Shipping capability: end-to-end autonomous maintenance cycles (predict → schedule → dispatch → verify → close → cost), autonomous arrears management within approved policy, autonomous procurement within pre-approved catalogues and limits, autonomous resident communication for defined categories, self-healing integrations, and dynamic resource allocation across the portfolio.

### 9. Administrator Features
- **Autonomy governance console** — per-agent scope, spending limits, escalation rules, operating hours and approval requirements.
- **Global and granular kill switches**, tested as part of every release.
- Automation change management with versioning, staged rollout and instant rollback.
- Segregation-of-duties enforcement extended to automated actors — an agent cannot both request and approve.
- Complete automated-action audit, retained under the same policy as human actions.

### 10. Executive Features
- **Autonomy dashboard** — what proportion of operations runs without human intervention, by process and by estate.
- **Value realisation reporting** — labour redeployed, cost avoided, response time improved, with methodology disclosed.
- **Risk posture view** — where autonomy is operating, at what authority level, with what exposure.
- **Strategic capacity planning** — what the organisation could take on with existing headcount given current automation coverage.

### 11. Mobile Improvements
- Mobile agent supervision — approve, pause or reverse automated actions from a phone.
- Push notification for any automated action requiring human awareness.
- Mobile exception handling designed to be completed in under a minute.

### 12. Security Improvements
- Agents hold explicit, scoped, expiring credentials — never inherited human permissions.
- Every autonomous action carries non-repudiable attribution.
- Anomaly detection on agent behaviour, with automatic suspension on deviation from expected patterns.
- Adversarial testing of every autonomous path before release.
- Blast-radius limits: hard caps on how many records or how much money any automation can affect in a given window.

### 13. Performance Improvements
- Scalable automation execution engine handling high event volume across 150 estates.
- Intelligent scheduling to smooth load and avoid peak-hour contention.
- Cost-aware model routing keeping AI unit economics sustainable at automation scale.
- Automation execution isolated from interactive workloads.

### 14. Business Value
Operational headcount requirements decouple from portfolio growth — the single most important economic fact for a management company that wants to grow from 150 estates to 400. Response times fall to minutes on routine matters. Consistency improves because policy is applied identically everywhere. And human staff move from processing to judgement, which is both more valuable and more retainable.

### 15. Why this release exists
Because the economics of estate management are labour economics, and because by V32 the platform finally has what autonomy requires: complete process definitions, high-quality data, mature permissions, comprehensive audit and a demonstrated track record of AI reliability under human supervision. Attempting this release earlier would have been reckless; attempting it later would leave value on the table.

**Preserved from V22:** every manual path remains fully available; a customer may run V32 with autonomy entirely disabled and lose nothing they had before.
**Non-goals:** no autonomous action affecting resident legal rights, no autonomous financial commitment outside pre-approved limits, no removal of human accountability.

---

# VERSION 33 — Enterprise Intelligence & Command

*Train theme: the whole portfolio, live, in one room.*

### 1. Release Vision
V33 is the strategic apex of the roadmap. It unifies eleven releases of data, process and intelligence into a live operational picture: an executive cockpit for decision-making, a digital twin of the physical portfolio, and a command centre for real-time operations. Nothing new is invented here — everything is connected.

### 2. New Enterprise Features
- **Enterprise Intelligence / Kurumsal Zeka** — a unified data and semantic platform spanning every module, with lineage, quality monitoring and a single governed definition for every business concept.
- **Executive Cockpit / Yönetici Kokpiti** — a strategic decision surface: objectives and key results, scenario modelling, portfolio simulation, capital allocation analysis and competitive benchmarking.
- **Digital Twin / Dijital İkiz** — a live model of the physical portfolio: buildings, systems, assets, sensors, occupancy, energy and condition, navigable spatially through an evolution of the V22 Site Haritası, with time-travel through historical states and forward simulation.
- **Operational Command Center / Operasyon Komuta Merkezi** — a real-time, large-screen-capable operations view: live incidents, field team positions, system alarms, SLA clocks and resource status across all estates, with incident command tooling for major events.
- **IoT integration layer** — ingestion from smart meters, heat cost allocators (ısı payölçer), water meters, generator controllers, lift telemetry, environmental and occupancy sensors, and access control.
- **Energy & sustainability module** — consumption monitoring, efficiency benchmarking, carbon accounting and retrofit business cases — increasingly a procurement requirement for larger estates.

### 3. UX Improvements
- **Command surface design** — legible at three metres on a wall display, using the frozen palette with an ambient-mode variant that dims chrome and raises signal.
- **Spatial navigation** — from portfolio map to estate to block to floor to unit to asset, with consistent interaction at every level.
- **Time control** — a scrub bar allowing any view to be replayed at a past moment, which transforms incident review.
- **Situational awareness patterns** — alarm hierarchies, colour discipline and audio conventions borrowed from control-room design, adapted to the existing visual language.
- **Zero-training executive cockpit** — every element self-explanatory, because this audience will not read documentation.

### 4. Dashboard Enhancements
- All prior dashboards are preserved and become entry points into the unified intelligence layer.
- New widgets: Live Operations Status, Portfolio Digital Twin Preview, Energy Performance, Sustainability Score, Strategic Objective Progress, Real-Time Alarm Summary.
- **Streaming data** on operational widgets — sub-second updates where the underlying source supports it.

### 5. AI Enhancements
- **Portfolio-level strategic analysis** — where value is being created and destroyed across 150 estates, and why.
- **Scenario simulation** — "what if we take on 40 more estates in this region with current staffing?"
- **Cross-domain causal analysis** connecting maintenance, finance, satisfaction and staffing.
- **Proactive strategic briefings** — the emerging issues leadership has not yet asked about.
- **Digital twin simulation** — modelling the effect of a proposed retrofit, a staffing change or a dues adjustment before committing to it.

### 6. Reporting Enhancements
- Fully automated board and investor reporting with narrative.
- Regulatory and statutory reporting automation, including ESG and energy performance where applicable.
- Real-time reporting — reports that are live views rather than snapshots.
- Cross-portfolio comparative and benchmarking studies.

### 7. Analytics Enhancements
- **Unified analytics** across every module with guaranteed consistency of definition.
- **Advanced modelling** — survival analysis on assets, elasticity analysis on dues, queueing models for staffing.
- **External data enrichment** — weather, economic indicators, regional property data, incorporated as explanatory variables.
- **Prescriptive analytics** — not only what will happen, but what to do about it, with expected outcomes.

### 8. Automation Enhancements
- **Portfolio-level orchestration** — resources allocated dynamically across estates according to real-time demand.
- **Automated incident command** — major incidents automatically assemble the response team, open the command view, notify stakeholders and begin the evidence record.
- **Predictive resource positioning** ahead of forecast demand (weather events, seasonal peaks, assembly season).
- **Energy optimisation automation** on connected systems.

### 9. Administrator Features
- Data platform governance: lineage, quality rules, retention and access policy in one console.
- IoT device management: provisioning, health, firmware, credential rotation.
- Command centre configuration: alarm thresholds, escalation trees, on-call rosters, display layouts.
- Digital twin data source management and reconciliation.

### 10. Executive Features
This is the release's purpose. The Executive Cockpit provides: strategic objective tracking against targets, portfolio performance with drill-down to any estate, scenario modelling for growth and investment decisions, capital allocation analysis grounded in V27 asset lifecycle and V28 financial data, risk exposure across every dimension, competitive and market benchmarking, and an AI strategic advisor answering questions across the entire enterprise with sourced evidence.

### 11. Mobile Improvements
- Command centre mobile companion for on-call and out-of-hours response.
- Mobile digital twin navigation with augmented-reality asset overlay on site.
- Executive cockpit tablet experience designed for board meetings.
- Critical alert delivery with escalation if unacknowledged.

### 12. Security Improvements
- IoT security: device identity, mutual TLS, network segmentation, firmware integrity verification.
- Command centre access control with physical-location awareness for restricted views.
- Strict protection of aggregated portfolio intelligence — the most commercially sensitive data the company holds.
- Advanced threat detection across the unified data platform.
- Business continuity: command centre functionality maintained under partial infrastructure failure.

### 13. Performance Improvements
- Real-time streaming architecture with sub-second end-to-end latency on operational events.
- Time-series storage optimised for high-frequency IoT ingestion at portfolio scale.
- Efficient 3D/spatial rendering in the digital twin with level-of-detail management.
- Independent scaling of the analytical platform from operational workloads.
- Command centre resilience — degraded-mode operation that never goes dark.

### 14. Business Value
Strategic decisions become evidence-based rather than intuitive, which compounds across every subsequent decision. Major incident response improves measurably, protecting both residents and the company's liability position. Energy optimisation delivers direct, verifiable savings to estate budgets. And the digital twin plus command centre become the decisive differentiator in tenders for large and prestige portfolios.

### 15. Why this release exists
Because after eleven releases the platform holds a complete picture of 150 estates, 25.000 residents, every asset, every process and every lira — and that picture is worth far more assembled than distributed. V33 assembles it.

**Preserved from V22:** the Site Haritası, the dashboard and every operational view remain exactly as they are; the digital twin is an additional, optional depth beneath them.
**Non-goals:** no requirement for IoT hardware — every V33 capability degrades gracefully to the data the customer actually has.

---

# VERSION 34 — Enterprise Maturity

*Train theme: make twelve releases feel like one product.*

### 1. Release Vision
V34 adds almost no new capability, and that is its point. After eleven releases of accumulation, the platform needs a consolidation release: every rough edge smoothed, every interaction refined, every accessibility gap closed, every performance regression eliminated, every inconsistency reconciled. This is the release that lets a customer compare V34 with V22 and say *this is the same product, twelve professional releases later.*

### 2. New Enterprise Features
Deliberately minimal, and all consolidating:
- **Unified Search** across every entity, document, communication and record in the platform, with permission-aware results.
- **Personal Workspace / Çalışma Alanım** — the user's own consolidated surface: their views, their pinned records, their drafts, their shortcuts, across all modules.
- **Onboarding & Adoption Center** — role-based guided tours, contextual help, an in-product academy and adoption analytics, so a customer arriving at V34 is not confronted with twelve releases of capability at once.
- **Platform Health Center** — a single administrator view of system health, data quality, adoption, automation performance and security posture.

### 3. UX Improvements
The heart of the release:
- **Interaction consistency audit** — every pattern in the product reconciled to one standard: how a filter behaves, how a form saves, how a confirmation reads, how a date is formatted, how an error is phrased. Twelve releases inevitably produce drift; V34 removes it.
- **Micro-interactions** — considered hover, focus, press, transition and success states throughout, using the frozen 0.2s/0.6s motion vocabulary. Every state change acknowledged; nothing happens silently.
- **Terminology reconciliation** — one Turkish glossary applied across the whole product, resolving every place where the same concept acquired two names.
- **Cognitive load reduction** — navigation reorganised *by grouping, never by removal*: the V22 sidebar items remain exactly where they are and later additions are organised beneath clear section headers.
- **Progressive disclosure of complexity** — new customers see a V22-scale product; capability reveals itself as they mature.
- **Error message rewrite** — every error states what happened, why, and what to do next, in plain Turkish.

### 4. Dashboard Enhancements
- **Dashboard template library** — curated starting layouts per role, with V22's "Klasik" first among them.
- **Widget catalogue rationalisation** — every widget accumulated across twelve releases reviewed for consistency of format, refresh behaviour and terminology.
- **Smart default layouts** — new users receive a role-appropriate dashboard that is useful on day one.
- **Cross-widget consistency** — one visual grammar for trend, target, threshold and comparison, applied to every widget in the catalogue.

### 5. AI Enhancements
- **Copilot consolidation** — one assistant, one entry pattern, consistent behaviour everywhere, rather than the several context-specific AI surfaces that accumulated across V25, V29 and V32.
- **Response quality pass** — tone, length, formality and Turkish register standardised.
- **Latency reduction** through caching and model routing.
- **Reliability hardening** — clear behaviour under every failure mode, never a dead end.

### 6. Reporting Enhancements
- **Report catalogue rationalisation** — duplicates merged, unused reports retired to a legacy section (retained, never deleted, per policy 2.6).
- **Visual consistency** across every report output.
- **Generation performance** — every standard report under five seconds.
- **Distribution reliability hardening.**

### 7. Analytics Enhancements
- **Metric reconciliation** — a final audit ensuring every metric, wherever it appears, is computed identically.
- **Data quality remediation** across historical records.
- **Query performance optimisation** on every analytical path.
- **Documentation completion** — every metric, dimension and calculation documented in the KPI Center.

### 8. Automation Enhancements
- **Automation audit** — every rule, workflow and agent reviewed for continued relevance; obsolete ones deactivated with notice rather than deleted.
- **Conflict detection** — automations that could contradict each other identified and resolved.
- **Reliability hardening** — retry, idempotency and failure handling standardised across every automated path.
- **Cost optimisation** of automation execution.

### 9. Administrator Features
- **Unified administration console** — every setting accumulated across twelve releases organised into one coherent, searchable structure.
- **Configuration templates** — a new estate configured to portfolio standards in minutes.
- **Bulk configuration management** across estates.
- **Change management** — configuration versioning, diff and rollback.
- **Health and adoption monitoring** with actionable recommendations.

### 10. Executive Features
- **Executive experience refinement** — every executive surface reviewed for the five-minute read.
- **Insight quality pass** — fewer, better, more actionable insights, ranked by materiality.
- **Board-ready output polish** across every executive artefact.
- **Value narrative** — an automatically maintained record of what the platform has delivered, which is precisely what an executive needs at renewal.

### 11. Mobile Improvements
- **Mobile parity audit** — every capability confirmed available or deliberately, documented-ly excluded on mobile.
- **Native feel refinement** — platform-appropriate gestures, transitions and haptics on iOS and Android.
- **Performance optimisation** for low-end devices and poor networks.
- **Battery and data efficiency** final pass.

### 12. Security Improvements
- **Comprehensive third-party penetration test and remediation.**
- **ISO 27001 and SOC 2 Type II readiness**, with evidence collection automated.
- **Complete KVKK compliance verification** across every module, including data subject rights workflows end to end.
- **Dependency and supply chain hardening**, with continuous scanning.
- **Incident response readiness** — tested playbooks, rehearsed procedures, defined communication templates.

### 13. Performance Improvements
- **Full performance audit** against the V23 budgets, tightened: LCP ≤ 1.5s, INP ≤ 100ms, CLS ≤ 0.02.
- **Bundle size reduction** across the accumulated twelve releases — the discipline that matters most, because feature accumulation is how enterprise products get slow.
- **Database and query optimisation** across every access path.
- **Infrastructure cost optimisation** without user-visible impact.
- **Load testing** at 3× current peak, validating the growth headroom the business plan assumes.

### 14. Business Value
Adoption of the capabilities already paid for rises sharply, which is where most enterprise software value is actually lost. Support cost falls with consistency and clarity. Sales cycles shorten because the product demonstrates as coherent rather than accumulated. Security certification unlocks the largest institutional customers. And renewal conversations become straightforward when the product feels faster and clearer than it did a year earlier.

### 15. Why this release exists
Because enterprise software fails not from lack of features but from the accumulated weight of them. Every mature platform — Office, Salesforce, ServiceNow — periodically stops adding and starts consolidating. V34 is that release: it makes twelve releases of evolution feel like one deliberate product, and it leaves the foundation clean enough that V35 can begin the next cycle without inheriting debt.

**Preserved from V22:** everything. V34's success criterion is that a V22 user can sit down at V34 and immediately recognise the product they already know.
**Non-goals:** no new modules, no new domains, no visual redesign, no removal of anything.

---

# Appendices

## Appendix A — Cumulative capability inventory

Read down the column to see how the platform grows without anything being subtracted.

| Layer | V22 | +V23–V26 | +V27–V30 | +V31–V34 |
|---|---|---|---|---|
| **Navigation** | 10 sidebar views | + Workflow Center, Executive Dashboard, Analytics, Reports | + Assets, Risk, Incidents, Finance, Communication, Field Ops | + Marketplace, Automation Center, Command Center, Workspace |
| **Dashboard widgets** | 4 | + ~16 | + ~18 | + ~12, all rationalised |
| **User roles** | Implicit | 7 formal roles | + Contractor, Resident, Field Tech | + Developer, Agent identities |
| **AI** | Chat + AI section | Copilot, NL search, forecasting | Predictive maintenance, photo triage, resident assistant | Autonomous agents, strategic advisor |
| **Automation** | — | Rules, approvals, notifications | Compliance & dispatch automation | Visual designer, rule engine, autonomy |
| **Reporting** | Ad hoc | Catalogue + builder + scheduling | Statutory & financial packs | Real-time, embedded, white-label |
| **Surfaces** | Web app + marketing site | + Executive views | + Resident portal, native mobile apps | + Marketplace, command centre, developer portal |
| **Security** | Baseline | MFA, RBAC, audit | Field & financial controls | SSO, plugin sandbox, ISO/SOC readiness |

## Appendix B — Design token changelog

The only permitted additions across twelve releases. Every entry derives from the frozen V22 set; nothing is replaced.

| Release | Added | Derivation |
|---|---|---|
| V23 | `--density-comfortable` / `--density-compact` | Existing 4px spacing scale |
| V23 | `--focus-ring` | `#0E7490` at fixed alpha |
| V23 | `--skeleton-base` / `--skeleton-shimmer` | Surface tints of `#0F172A` |
| V24 | `--status-pending` / `--status-approved` / `--status-rejected` | `#2563EB`, `#10B981`, existing danger ramp |
| V24 | `--sla-ok` / `--sla-risk` / `--sla-breach` | Existing semantic ramp |
| V25 | `--ai-surface` | Existing gradient at reduced opacity |
| V26 | `--chart-series-1…8` | Ordered ramp from `#0E7490` → `#2563EB` |
| V27 | `--severity-1…4` | Existing semantic ramp, fixed steps |
| V29 | `--type-scale-large` | Existing DM Sans scale, one step up, for elderly resident accessibility |
| V30 | `--touch-target-min` (44px), `--outdoor-contrast` | Existing tokens, threshold-adjusted |
| V33 | `--ambient-dim` | Opacity modifier for wall-display mode |
| V34 | — | Audit only; no additions |

**Never added across twelve releases:** a new hue, a new typeface, a new weight, a new card style, a new elevation model, a new grid.

## Appendix C — Release readiness gates

Every release must clear all seven gates before GA:

1. **Visual regression** — automated screenshot diff against V22 reference set returns zero unintended differences.
2. **Accessibility** — WCAG 2.2 AA verified on all new surfaces; keyboard-only walkthrough completed.
3. **Performance** — all budgets met on a mid-range Android device over a throttled 4G connection.
4. **Localisation** — 100% Turkish and English coverage, reviewed by a native domain speaker.
5. **Security** — threat model reviewed, new endpoints tested, permissions verified, KVKK record updated.
6. **Migration** — existing tenants upgrade with zero required action and zero behaviour change until they opt in.
7. **Enablement** — documentation, release notes, admin controls and support briefing complete.

## Appendix D — Risk register for the roadmap itself

| Risk | Impact | Mitigation |
|---|---|---|
| Feature accumulation makes the product feel heavy | Adoption decline | V34 consolidation release; progressive disclosure from V23; adoption analytics from V26 |
| Design drift across twelve releases | Loss of coherence | Frozen token set; component versioning; visual regression gate on every release |
| Performance decay from accumulation | Churn | Budgets enforced from V23 and tightened at V34; bundle size tracked per release |
| AI trust failure | Rejection of V25/V32 investment | Provenance from V23; human-in-the-loop until V32; simulation before activation; kill switches |
| Autonomy incident | Severe commercial and legal exposure | Blast-radius limits, spending caps, segregation of duties for agents, staged authority gradient |
| Customer overwhelm at upgrade | Support load spike | Everything opt-in and off by default; onboarding centre in V34; per-tenant feature flags from V23 |
| Ecosystem fragmenting the UI | Brand dilution | Plugins styled by the platform; no token override permitted; certification review |
| Regulatory change (KVKK, KMK, e-Document) | Compliance gap | Compliance calendar in V27; rule engine in V32 makes statutory logic configurable rather than coded |

## Appendix E — The final comparison

Placed side by side, V22 and V34 should read as follows.

**Identical:** the logo, the palette, DM Sans, the glass cards, the glow, the gradient headline treatment, the sidebar with its ten original views in their original order, the four stat cards, the collection chart, the site map, the four original widgets, the marketing site's structure and voice, the interaction rhythm, the tone of the Turkish copy.

**Different:** the product now manages assets and risk, runs its own workflows, forecasts its own finances, serves 25.000 residents directly, works offline in a basement, extends through a marketplace, automates its own routine, and presents the whole portfolio to leadership in one live picture — while loading faster than it did in V22.

That is the target. Not *another website*. The same enterprise SaaS platform, twelve professional software releases later.
