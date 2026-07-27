# BN Yönetim — Dashboard Module
## Sprint 01 · Enterprise Implementation Specification (STEP 1 – STEP 8)

**Module:** Dashboard (only)
**Baseline:** Version 22 — frozen, approved, untouched
**Mode:** Enrichment. No redesign of platform, navigation, design system or component library.
**Scope discipline:** No other module is designed, generated or modified in this sprint. Where the Dashboard touches another module, it does so **read-only** or by creating a record through that module's own contract.

---

# STEP 1 — MODULE ANALYSIS

## 1.1 Purpose of the Dashboard

The Dashboard is the platform's **operational front door**. Its single job is to answer one question faster than any other screen in the product:

> *"What requires my attention right now, and what can I safely ignore?"*

It is deliberately **not** a reporting tool (that is the Reports module), **not** an analysis tool (that is Analytics), and **not** a work surface (work happens in Görevler, İş Emirleri, Finans). The Dashboard is a **routing and triage surface**: it surfaces exceptions, ranks them, and hands the user off to the module where the work actually gets done.

Three design commitments follow from that purpose:

1. **Ten-second rule.** A user must be able to determine whether anything is wrong within ten seconds of load, without scrolling, without filtering, without clicking.
2. **Exception-first, not inventory-first.** The Dashboard leads with deviation, not with volume. "47 aktif görev" is inventory; "3 görev SLA sınırını aştı" is an exception. Both are shown, but the exception governs visual priority.
3. **Every number is a door.** No figure on the Dashboard is terminal. Every KPI, every chart segment, every widget value drills through to the filtered list that produced it.

## 1.2 Target users

| Role | Turkish label | What they open the Dashboard for | Default landing tab |
|---|---|---|---|
| Portfolio Manager | Portföy Yöneticisi | Which of my 150 estates is deviating today | Genel Bakış |
| Estate Manager | Site Yöneticisi | What is happening in my estate today | Bugünün Operasyonu |
| Finance / Accounting | Muhasebe & Finans | Collection position, arrears movement, cash | Finansal Özet |
| Technical Lead | Teknik Şef | Open work orders, breakdowns, statutory inspection deadlines | Teknik Özet |
| Security Supervisor | Güvenlik Amiri | Shift coverage, incidents, access events | Operasyon |
| Cleaning Supervisor | Temizlik Şefi | Programme completion, staffing, consumables | Operasyon |
| Auditor | Denetçi | Read-only financial and compliance position | Finansal Özet |
| Executive | Üst Yönetim | Portfolio health, exceptions, decisions pending | Genel Bakış (executive layout) |
| System Administrator | Sistem Yöneticisi | Platform health, adoption, integration status | KPI Merkezi |

**Explicitly out of scope:** residents. The resident-facing surface is the Resident Portal (a separate module, V29). The Dashboard is a staff and governance surface only. This boundary is enforced at the permission layer, not by UI hiding.

## 1.3 User goals

- **Triage** — identify the small number of things that are wrong among a large number of things that are fine.
- **Orient** — understand the current state of the portfolio or estate against its own recent history and its target.
- **Act** — start the highest-value action without navigating through menus (Quick Actions).
- **Delegate** — assign, escalate or approve directly from the surface where the problem was noticed.
- **Report upward** — extract a defensible snapshot for a board, an owner assembly or a client.

## 1.4 Daily workflows

**08:00 — Morning check (Site Yöneticisi).** Opens Dashboard → Critical Alerts banner read first → Bugünün Operasyonu tab → reviews overnight incidents, today's scheduled maintenance, staff attendance → assigns unassigned work orders via Quick Action → closes.
*Target duration: under four minutes.*

**Through the day — Ambient monitoring.** Dashboard remains open in a tab. Auto-refresh on a 60-second cycle for operational widgets, 15-minute cycle for financial widgets. New critical alerts announce via toast and, if the tab is backgrounded, via the title badge.

**17:30 — Day close.** Reviews completion rates, SLA breaches, tomorrow's schedule, unresolved resident requests. Generates the daily snapshot for the estate's board WhatsApp group via Export.

**Monday 09:00 — Weekly (Portföy Yöneticisi).** Genel Bakış with 7-day range → exception list of deviating estates → drills into the worst three → assigns follow-ups.

**Month-end (Muhasebe).** Finansal Özet with month range → collection rate against target → arrears ageing → exports the collection pack.

## 1.5 Information architecture

The Dashboard is organised on **three orthogonal axes**, all of which persist across tabs and across sessions:

```
        SCOPE  ──────────►   Portfolio → Estate Group → Estate → Block
          │
        TIME   ──────────►   Today · 7d · 30d · Quarter · Year · Custom
          │
     PERSPECTIVE ────────►   9 submodule tabs (Genel Bakış → Widget Yöneticisi)
```

Within any tab, content follows a fixed **four-band vertical rhythm**, which is the single most important consistency rule in this module:

1. **Band 1 — Exceptions.** Critical alerts. Red/amber only. Absent when nothing is wrong (and its absence is itself information).
2. **Band 2 — KPIs.** Four to six numbers with trend, delta and target.
3. **Band 3 — Trend.** One or two charts giving the shape behind the numbers.
4. **Band 4 — Detail.** Lists, tables, activity feeds, widgets.

Every tab uses this rhythm. A user who learns one tab has learned all nine.

## 1.6 Integration with other modules

The Dashboard is a **consumer**, not an owner, of business data. It owns exactly four things: layout preferences, widget instances, saved views, and alert acknowledgements.

| Module | Direction | What the Dashboard does |
|---|---|---|
| Görevler / İş Emirleri | Read + Create | KPI counts, SLA state, backlog; Quick Action creates a work order through the module's own API and validation |
| Takvim | Read | Today's and this week's scheduled events |
| Bildirimler | Read + Ack | Unread counts, critical alerts; acknowledgement writes back |
| Site Haritası | Read | Block/unit context, estate selector source of truth |
| Grafikler | Read | Chart definitions reused, never redefined |
| AI Chat / BN AI | Read + Invoke | Insight cards, daily summary, copilot entry point |
| Finans (V28) | Read | Collection rate, arrears ageing, cash position |
| Demirbaş & Bakım (V27) | Read | Asset health, inspection deadlines, maintenance backlog |
| Personel | Read | Attendance, shift coverage |
| Sakin Talepleri (V29) | Read | Open request count, satisfaction index |
| Raporlar | Invoke | Export and snapshot generation |

**Integration contract:** the Dashboard never duplicates business logic. A work order's SLA state is computed by the work order module and consumed here. If the Dashboard and the İş Emirleri module ever disagree about a number, the İş Emirleri module is correct by definition — and that is a bug in the Dashboard, not a business question.

---

# STEP 2 — SUBMODULE DESIGN

Nineteen submodules. Nine are surfaced as tabs; ten are always-on regions or overlays available from every tab. Every submodule below specifies Purpose, Displayed Information, User Actions, Permissions and Business Value.

---

### 2.1 Executive Overview / Genel Bakış  `TAB · default`

**Purpose.** The default landing perspective. Portfolio or estate health in one screen, preserving the exact Version 22 dashboard composition as its core.

**Displayed information.** The four frozen V22 stat cards (Toplam Site 150 · Aktif Görev 47 · Bildirimler 12 · Toplam Sakin 25.000+), each now carrying a 13-point sparkline, a period delta and an optional target. The frozen Aylık Aidat Tahsilatı bar chart, now with prior-year overlay and budget line. Portfolio health score. Exception list (five most-deviating estates). Recent activity feed. The four frozen widgets (İstanbul weather, energy consumption, tahsilat %94, açık iş emri).

**User actions.** Change scope · change time range · drill into any KPI · open exception detail · acknowledge alerts · export snapshot · switch to executive layout.

**Permissions.** `dashboard.view` for all authenticated staff. Portfolio-wide figures require `scope.portfolio`; estate users see their own estates only, enforced server-side.

**Business value.** Reduces the time between a problem occurring and a human noticing it — the single largest source of avoidable cost in multi-estate management.

---

### 2.2 Today's Operations / Bugünün Operasyonu  `TAB`

**Purpose.** The estate manager's working shift, hour by hour.

**Displayed information.** Today's scheduled maintenance and inspections · shift coverage by function (güvenlik, temizlik, teknik) · attendance status · work orders opened, closed and in progress today · today's incidents · deliveries and contractor arrivals expected · today's resident requests · weather-driven operational risk (ice, storm, heat).

**User actions.** Assign or reassign a work order · mark attendance exception · log an incident · confirm contractor arrival · escalate an overdue item · message a team.

**Permissions.** `dashboard.operations.view`; write actions require the corresponding module permission (`workorder.assign`, `incident.create`).

**Business value.** Converts the morning meeting into a screen. Removes the daily reconstruction of "what is happening today" from phone calls and WhatsApp.

---

### 2.3 AI Insights / AI İçgörüleri  `TAB`

**Purpose.** Surface what the user has not thought to ask.

**Displayed information.** Ranked insight cards, maximum five, each carrying: a plain-Turkish finding, quantified impact, confidence level, evidence links and a recommended action. Insight categories: financial anomaly, maintenance prediction, satisfaction risk, workload imbalance, compliance deadline, cost outlier.

**User actions.** Accept and convert to task · dismiss with reason · request explanation · view evidence records · adjust insight sensitivity.

**Permissions.** `dashboard.ai.view`; insights are permission-filtered — a user never sees an insight derived from data they cannot access.

**Business value.** Moves the organisation from reactive to proactive without requiring anyone to learn analytics.

---

### 2.4 KPI Center / KPI Merkezi  `TAB`

**Purpose.** Every governed metric in one place, with its definition visible.

**Displayed information.** KPI grid grouped by domain (Finansal, Operasyonel, Teknik, Memnuniyet, Personel). Each KPI shows current value, target, variance, 13-period trend, owner, refresh timestamp, and its formula on demand.

**User actions.** Filter by domain or status · pin a KPI to Genel Bakış · set or change a target (privileged) · view definition · drill to source · export.

**Permissions.** `kpi.view` to read; `kpi.target.edit` to change targets; `kpi.definition.edit` restricted to System Administrator.

**Business value.** Ends the "which number is right" argument permanently by making definition, owner and freshness first-class, visible attributes.

---

### 2.5 Financial Summary / Finansal Özet  `TAB`

**Purpose.** The money position at a glance.

**Displayed information.** Collection rate against target · this period's charged, collected and outstanding · arrears ageing (0–30 / 31–60 / 61–90 / 90+) · cash position and reserve fund level · budget variance by category · top ten debtor units (permission-gated) · upcoming payment obligations · collection forecast.

**User actions.** Drill to unit statements · trigger a reminder run · export the collection pack · open the arrears list · compare estates.

**Permissions.** `finance.summary.view`. Unit-level debtor identity requires `finance.debtor.view` — a deliberate separation, since aggregate position is widely useful while named debt is sensitive under KVKK.

**Business value.** Collection rate is the highest-leverage metric in estate management; a two-point improvement across 25.000 units is a very large sum flowing directly to estate liquidity.

---

### 2.6 Technical Summary / Teknik Özet  `TAB`

**Purpose.** The physical condition of the buildings.

**Displayed information.** Open work orders by category and priority · SLA compliance and breaches · asset health index · statutory inspection countdown (asansör periyodik kontrol, yangın tüpü, jeneratör, paratoner, hidrofor, havuz analizi) · maintenance backlog and its age · breakdown frequency by system · contractor performance · energy and water consumption trend.

**User actions.** Assign work orders · escalate SLA risk · schedule maintenance · view asset history · contact contractor · export the compliance pack.

**Permissions.** `technical.summary.view`; assignment requires `workorder.assign`.

**Business value.** Statutory compliance becomes provable rather than assumed. Emergency call-out premiums fall as predicted failures replace surprise ones.

---

### 2.7 Security Summary / Güvenlik Özeti  `TAB group: Operasyon`

**Purpose.** Site security posture and coverage.

**Displayed information.** Shift coverage and gaps · guard attendance · patrol round completion (tur kontrol) · access events summary · visitor volume · incident log · camera system health · alarm activations · gate and barrier faults.

**User actions.** Log an incident · flag a coverage gap · request a replacement guard · review an access anomaly · export a shift report.

**Permissions.** `security.summary.view`. Camera and access-control detail requires `security.sensitive.view`; all access to identified personal movement data is itself audited.

**Business value.** Coverage gaps are the most common source of security failure and the most common contractual dispute with security suppliers; making them visible in real time resolves both.

---

### 2.8 Cleaning Summary / Temizlik Özeti  `TAB group: Operasyon`

**Purpose.** Cleaning programme execution and quality.

**Displayed information.** Programme completion rate by area and by day · staff attendance · area-level status (blok girişleri, asansörler, otopark, sosyal tesis, dış alan) · quality inspection scores · consumable stock levels and reorder points · resident cleanliness complaints correlated with area.

**User actions.** Mark an area complete · record an inspection score · raise a re-clean request · order consumables · reassign staff.

**Permissions.** `cleaning.summary.view`; quality scoring requires `cleaning.inspect`.

**Business value.** Cleanliness is the most visible service to residents and the strongest driver of everyday satisfaction; it is also the easiest service to under-deliver invisibly.

---

### 2.9 Personnel Status / Personel Durumu  `TAB group: Operasyon`

**Purpose.** Who is working, where, and whether coverage is adequate.

**Displayed information.** Headcount present versus planned by function and estate · today's absences with reason · leave calendar · overtime accumulation · shift schedule for the next 48 hours · certification and training expiry · open positions.

**User actions.** Record absence · approve or request leave · assign overtime · reassign staff between estates · export puantaj data.

**Permissions.** `personnel.summary.view`. Individually identifiable HR data (health-related absence reason, salary, disciplinary) is never surfaced on the Dashboard at any permission level — it lives in the HR module behind separate controls. This is a KVKK special-category data boundary, not a UI preference.

**Business value.** Coverage gaps are found before they become service failures rather than after.

---

### 2.10 Resident Requests / Sakin Talepleri  `TAB group: Sakin`

**Purpose.** The demand side of the operation.

**Displayed information.** Open requests by category, age and estate · first-response and resolution times against target · requests breaching response SLA · satisfaction index and trend · recurring complaint themes (AI-clustered) · request volume trend and seasonality.

**User actions.** Assign · respond · convert to work order · escalate · close with resolution note · trigger a satisfaction survey.

**Permissions.** `resident.request.view`; responding requires `resident.request.respond`.

**Business value.** Response time correlates with resident satisfaction far more strongly than resolution cost — and satisfaction determines management contract renewal.

---

### 2.11 Work Orders / İş Emirleri  `REGION · within Teknik Özet and Bugünün Operasyonu`

**Purpose.** The operational backbone view, embedded rather than duplicated.

**Displayed information.** Prioritised list preserving the exact Version 22 task-list composition (title – estate – priority badge Acil / Orta / Düşük), extended with assignee, age, SLA state and asset link.

**User actions.** Open · assign · change priority · add note · close · bulk-select for bulk assignment.

**Permissions.** Inherited entirely from the İş Emirleri module. The Dashboard grants nothing additional.

**Business value.** Removes navigation friction between noticing and acting.

---

### 2.12 Upcoming Tasks / Yaklaşan Görevler  `REGION · "Bugünüm" card`

**Purpose.** The current user's personal queue.

**Displayed information.** My assigned tasks due today and this week · my pending approvals · my mentions · my overdue items · my calendar for today.

**User actions.** Complete · reschedule · delegate · open · snooze.

**Permissions.** Self-scoped by definition; requires no additional grant.

**Business value.** Personal accountability made visible without a separate to-do product.

---

### 2.13 Calendar Snapshot / Takvim Özeti  `REGION`

**Purpose.** Temporal awareness without leaving the Dashboard.

**Displayed information.** A compact seven-day strip preserving the Version 22 Takvim visual language, with event density indicators, statutory deadlines highlighted, and assembly or board meeting dates pinned.

**User actions.** Open a day · create an event · jump to the full Takvim module.

**Permissions.** `calendar.view`.

**Business value.** Statutory and governance deadlines are the most expensive dates to miss in this domain.

---

### 2.14 Critical Alerts / Kritik Uyarılar  `ALWAYS-ON BAND`

**Purpose.** The one region that overrides every other priority on the screen.

**Displayed information.** Severity-1 and severity-2 events only: water ingress, lift entrapment, fire alarm activation, power loss, security breach, statutory deadline inside 7 days, cash shortfall projected inside 30 days, SLA breach on a critical asset.

**User actions.** Acknowledge (recorded with identity and timestamp) · assign · escalate · open the incident · snooze with mandatory reason.

**Permissions.** Visible to all staff with `dashboard.view`; acknowledgement requires `alert.acknowledge`. Snooze requires a reason and is audited.

**Business value.** The difference between a leak found in ten minutes and one found the next morning is measured in tens of thousands of lira.

---

### 2.15 Notifications / Bildirimler  `OVERLAY · drawer`

**Purpose.** The full notification stream, preserving the Version 22 Bildirimler presentation.

**Displayed information.** Chronological stream with category, estate, age and read state. Filters by category and estate. Digest preferences entry point.

**User actions.** Read · mark all read · filter · open source record · adjust preferences.

**Permissions.** Self-scoped.

**Business value.** Nothing is lost between shifts.

---

### 2.16 Quick Actions / Hızlı İşlemler  `ALWAYS-ON BAND`

**Purpose.** Collapse the distance between noticing and doing.

**Displayed information.** Six role-adaptive actions. Site Yöneticisi default set: Yeni İş Emri · Duyuru Yayınla · Aidat Hatırlatması · Personel Ata · Olay Kaydı · Rapor Al.

**User actions.** Launch any action in a dialog without leaving the Dashboard; the record is created through the owning module's API and validation.

**Permissions.** Each action is hidden — not disabled — when the user lacks the underlying module permission, so the surface never advertises capability the user does not have.

**Business value.** The most frequent operations lose three to five navigation steps each, several dozen times a day.

---

### 2.17 Recent Activities / Son Hareketler  `REGION`

**Purpose.** Situational awareness of what colleagues are doing, preserving the Version 22 activity feed.

**Displayed information.** Chronological event stream: work orders created and closed, payments received, announcements published, approvals granted, incidents logged — each with actor, estate, object and time.

**User actions.** Filter by type or actor · open the source record · load more.

**Permissions.** Permission-filtered per event; a user never sees an activity concerning a record they cannot access.

**Business value.** Prevents duplicated effort and provides an informal audit surface.

---

### 2.18 Reports Snapshot / Rapor Özeti  `REGION`

**Purpose.** The bridge from monitoring to distribution.

**Displayed information.** Recently generated reports · scheduled reports and their next run · one-click standard snapshots (günlük operasyon özeti, haftalık yönetim raporu, aylık tahsilat özeti).

**User actions.** Generate · download PDF/XLSX · schedule · share by secure link.

**Permissions.** `report.generate`; distribution requires `report.share`.

**Business value.** The board update stops being a manual assembly job.

---

### 2.19 Widget Manager / Widget Yöneticisi  `TAB`

**Purpose.** Personalisation without fragmentation, preserving the Version 22 Widgetlar view as its catalogue.

**Displayed information.** Widget catalogue with category, description, size, required permission and data source. Current layout with drag handles. Layout templates by role. The four Version 22 widgets appear as the first four catalogue entries, unmodified.

**User actions.** Add · remove · resize · reorder · set refresh interval · reset to the "Klasik" Version 22 default · save as a template (privileged) · assign a template to a role (administrator).

**Permissions.** `dashboard.layout.edit` for personal layout; `dashboard.template.manage` for role defaults.

**Business value.** Nine roles get nine appropriate dashboards from one codebase, and the Version 22 layout remains permanently one click away.

---

# STEP 3 — SCREEN DESIGN

## 3.1 Global layout

The Version 22 application shell is preserved exactly: fixed left sidebar at 240px carrying the ten approved navigation items in their approved order, with the approved active state (3px right border `#0E7490`, fill `rgba(14,116,144,0.15)`). Content region is fluid with a 1440px maximum and 24px gutters.

```
┌────────────┬──────────────────────────────────────────────────┐
│  SIDEBAR   │  APP HEADER   title · date · search · bell · me  │
│  (V22,     ├──────────────────────────────────────────────────┤
│  frozen,   │  BAND 1  critical alerts                         │
│  10 items) ├──────────────────────────────────────────────────┤
│            │  TOOLBAR  scope · time · density · edit · export  │
│            ├──────────────────────────────────────────────────┤
│            │  TABS  9 submodule tabs (scrollable)             │
│            ├──────────────────────────────────────────────────┤
│            │  BAND 2  KPI cards        (12-col grid)          │
│            │  BAND 3  charts                                  │
│            │  BAND 4  lists · tables · widgets                │
└────────────┴──────────────────────────────────────────────────┘
```

Grid: 12 columns, 16px gutter. KPI cards span 3 (desktop), 6 (tablet), 12 (mobile). Charts span 8 + 4 or 6 + 6. Widgets span 3 or 4.

## 3.2 Cards

**KPI card.** Built from the frozen `.stat-card` glass treatment. Composition top to bottom: label (11px, 600, uppercase, `--muted-2`, letter-spacing .1em) · value (32px, 800, tabular-nums) · delta chip (success `#10B981` for favourable, amber for caution, red for adverse — direction of favourability is per-metric configuration, since falling energy consumption is good and falling collection is not) · 13-point sparkline (SVG, 1.5px stroke, `#0E7490`) · target line and label when a target exists. Entire card is a button with `role="button"`, `tabindex="0"`, keyboard-activatable, drilling through to the source list.

**Insight card.** Left accent bar in the gradient. Category chip · confidence chip · finding in plain Turkish · quantified impact · two actions (birincil: göreve dönüştür, ikincil: yoksay) · evidence link revealing source records.

**Alert card.** Severity-coloured left border (4px). Severity chip · title · estate and location · elapsed time · acknowledge and open actions. Acknowledged alerts collapse to a single muted line rather than disappearing.

## 3.3 Widgets

All Version 22 widgets are preserved byte-for-byte in composition: İstanbul weather (28°C, Güneşli), energy consumption (↓12% geçen aya göre), tahsilat oranı (%94, Temmuz 2026), açık iş emri (23 — 5 acil, 18 normal). Each gains: a header with title, refresh timestamp and an overflow menu (yenile, kaldır, boyutlandır, kaynağa git); a loading skeleton; an error state with retry; and a drill-through target. New widgets follow the identical contract.

**Widget contract (mandatory for every widget, existing and future):** `id · title · size · dataSource · refreshInterval · requiredPermission · drillTarget · states{loading,empty,error,ok}`.

## 3.4 Charts

Chart grammar is fixed product-wide and defined here: **bar** for period comparison, **line** for continuous trend, **stacked bar** for composition over time, **donut** for share of a whole with six or fewer segments, **horizontal bar** for ranked comparison. No other chart type is permitted on the Dashboard.

The Version 22 Aylık Aidat Tahsilatı bar chart is preserved in its exact visual form (CSS-driven bars, 0.6s growth transition, `#0E7490`) and extended with: prior-year overlay as a lighter outline series, a dashed budget line, hover tooltips with exact figures, and click-to-drill on each bar. Series colours derive from the frozen ramp `#0E7490 → #2563EB` only.

Every chart carries a text alternative: an accessible data table available via a "Tabloyu göster" toggle, which is both an accessibility requirement and a genuinely used feature for finance staff.

## 3.5 Tables

Sticky header · sortable columns · resizable columns · column visibility menu · row selection with a bulk action bar · row hover at `rgba(255,255,255,.03)` · zebra striping off (V22 convention) · virtualised beyond 100 rows · server-side pagination at 50 rows per page · all numeric columns right-aligned with tabular numerals · every row keyboard-navigable with Enter to open.

## 3.6 Buttons

Frozen hierarchy: **primary** gradient `135deg #0E7490 → #2563EB`, white text, 600; **secondary** transparent with `rgba(255,255,255,.06)` border; **tertiary/ghost** text-only in `--muted`; **danger** red border and text, filled only on confirmation dialogs. Minimum touch target 44×44px throughout. Every icon-only button carries an `aria-label` and a tooltip.

## 3.7 Filters

**Scope selector** — preserves the Version 22 quick-filter chip row (Tüm Siteler · Yıldız Sitesi · Deniz Sitesi · Park Sitesi) and extends it with an overflow "Tüm siteler (150)" picker offering search, estate groups and multi-select for portfolios beyond a handful of estates.

**Time range** — segmented control: Bugün · 7 Gün · 30 Gün · Çeyrek · Yıl · Özel. Persists across tabs and sessions.

**Density** — Rahat (V22 default, unchanged) · Sıkışık. A single spacing token swap on the existing 4px scale.

Active filters are always visible as removable chips above the content; there is no hidden filter state on this module, ever.

## 3.8 Search

Global command palette on `Ctrl/⌘ + K`. Searches estates, blocks, units, residents, work orders, tasks, documents and dashboard actions. Grouped results with keyboard navigation, recent items on open, and action commands ("yeni iş emri oluştur") alongside record results. The Version 22 header search remains in place and shares the same index.

## 3.9 Dialogs

Quick Action dialogs (create work order, publish announcement, log incident) · drill-through detail dialog · widget configuration dialog · export dialog · confirmation dialogs for destructive actions. All dialogs: focus trapped, `Esc` to close, focus returned to the invoking element on close, `role="dialog"` with `aria-modal="true"` and an `aria-labelledby` reference, backdrop `rgba(6,11,20,.72)` with 8px blur.

## 3.10 Tooltips

Delay 400ms in, 100ms out. Attached via `aria-describedby`. Used for: metric definitions, truncated text, icon-only buttons, chart data points, abbreviated statuses. Never used to carry information available nowhere else.

## 3.11 Notifications (toasts)

Bottom-right stack, maximum three visible. Success 4s auto-dismiss; error persistent until dismissed; critical alerts announced through `aria-live="assertive"`, everything else through `aria-live="polite"`. Every toast offers an undo where the action is reversible.

## 3.12 Responsive behaviour

| Breakpoint | Layout |
|---|---|
| ≥1440px | Full 12-column; four KPI cards per row; sidebar expanded |
| 1024–1439px | 12-column; four KPI cards; sidebar expanded |
| 768–1023px | 8-column; two KPI cards per row; sidebar collapses to icon rail |
| 480–767px | Single column; KPI cards full width; V22 mobile nav toggle; tabs become a horizontally scrollable strip; filters move into a bottom sheet; charts reduce to 200px height |
| <480px | Single column; density forced to Rahat for touch; tables become stacked cards; bottom tab bar option |

The Version 22 mobile menu toggle and mobile nav are preserved exactly and continue to control the primary navigation at every breakpoint.

## 3.13 State design

**Loading.** Skeleton screens matching the exact geometry of the loaded content — never a spinner for content areas. KPI cards show a shimmer bar at value position. Charts show a muted grid. Progressive: KPIs resolve first (target under 1.2s), then charts, then lists. The screen is never blank and never jumps.

**Empty.** Distinguished by cause, with different copy and different actions for each: *no data yet* (new estate — offers setup), *no results for this filter* (offers filter reset), *nothing wrong* (the good empty state — "Kritik uyarı yok" with a success mark, deliberately reassuring rather than blank).

**Error.** Per-widget, never whole-screen: a failing widget shows its own error state with a retry button while every other widget continues to function. Copy states what failed, why, and what to do. Errors are logged with a correlation ID displayed to the user for support.

**Partial.** When some data sources succeed and others fail, the surface says so explicitly with an "Bazı veriler yüklenemedi" banner rather than silently showing incomplete figures — the most dangerous failure mode for a financial dashboard.

**Stale.** When auto-refresh fails, figures dim to 60% opacity and a "Son güncelleme 14:32" chip appears. Users must never read stale numbers believing them current.

---

# STEP 4 — BUSINESS FLOW

## 4.1 User flow (morning check, Site Yöneticisi)

```
Login → Dashboard loads (scope + time restored from last session)
  → Critical Alerts band read first
    ├─ alerts present → acknowledge → assign or escalate → toast confirms
    └─ none → "Kritik uyarı yok" reassurance state
  → KPI band scanned for adverse deltas
    └─ adverse delta → click KPI → drill-through dialog → filtered list → act
  → Bugünün Operasyonu tab → today's schedule, coverage, attendance
    └─ unassigned work order → Quick Action: assign → toast + undo
  → Bugünüm card → personal tasks and approvals cleared
  → Export → günlük operasyon özeti → shared with the board
```

## 4.2 Business flow

Operational events (a fault reported, a payment received, an inspection due, a guard absent) are generated by their owning modules. The Dashboard subscribes to these events, evaluates them against **alert rules** and **KPI thresholds**, ranks the resulting exceptions by severity and business impact, and presents them. Human action taken on the Dashboard is executed through the owning module's API, which applies that module's own validation and audit. The Dashboard therefore adds **triage and routing** value without owning business logic — a boundary that keeps the module maintainable across the next twelve releases.

## 4.3 Data flow

```
Source modules ──► Event bus ──► KPI/aggregation service ──► Cache (Redis)
                                        │                        │
                                        ▼                        ▼
                                 Alert rule engine        Dashboard API
                                        │                        │
                                        └────► WebSocket ────────┴──► Client
```

Freshness tiers, chosen to balance cost against consequence: **real-time** via WebSocket for critical alerts; **60 seconds** for operational counters; **15 minutes** for financial aggregates; **hourly** for satisfaction and analytical indices; **daily** for benchmark comparisons. Every figure renders its tier as a freshness timestamp on hover, so no user ever has to guess how current a number is.

Client caching: stale-while-revalidate. Cached values render immediately and are visually marked stale until refreshed, giving instant perceived load without ever showing an unlabelled stale figure.

## 4.4 Approval flow

The Dashboard **surfaces** approvals and **captures** decisions; it does not define approval logic (that is the Workflow module, V24).

```
Approval request created (any module)
  → appears in Bugünüm card + notification + badge
  → user opens from Dashboard → context dialog shows full request, amount,
    justification, requester, policy threshold, prior approvals
  → Approve / Reject / Delegate / Request info
     ├─ amount above step-up threshold → re-authentication required
     ├─ segregation of duties violated → blocked with explanation
     └─ decision recorded (identity, timestamp, IP, device) → workflow advances
  → toast + audit entry + requester notified
```

## 4.5 Notification flow

```
Event → classification (category, severity, audience)
      → permission filter (never notify a user about data they cannot see)
      → user preference filter (channel, quiet hours, digest)
      → rate limit and de-duplication (identical alerts collapse with a count)
      → delivery: in-app badge + toast (if session active)
                  + drawer entry (always)
                  + push/e-mail/SMS (per preference, delivered by V24/V30)
      → acknowledgement recorded → escalation timer cancelled
      → unacknowledged severity-1 after 15 minutes → automatic escalation
```

## 4.6 AI flow

```
Scheduled (06:00 daily) + on-demand
  → context assembly: tenant data within the requesting user's permission scope
  → anomaly detection across KPI history (statistical, not generative)
  → candidate insights generated with evidence record IDs attached
  → ranking by quantified business impact × confidence
  → top five retained; generative layer writes the plain-Turkish finding
  → human review: accept → task created | dismiss → reason captured as signal
  → feedback loop refines ranking and sensitivity per tenant
```

**Governing constraint.** The AI never acts autonomously in this module. It ranks, explains and drafts; a human decides. Autonomy is a V32 question and is explicitly out of scope for Sprint 01.

---

# STEP 5 — AI FEATURES

**5.1 AI Daily Summary / Günlük Özet.** Generated at 06:00 and on demand. Three paragraphs in plain Turkish: what happened since yesterday, what needs attention today, what is trending. Role-adapted — the Muhasebe summary leads with collection, the Teknik Şef summary leads with breakdowns. *Why:* replaces the fifteen minutes each manager spends reconstructing the overnight picture.

**5.2 Predictive Alerts / Öngörülü Uyarılar.** Forecasts problems before they occur: collection tracking below the same period last year; a work order likely to breach SLA given current progress; an asset whose failure probability has crossed threshold; a cash position projected to fall short within 30 days. *Predicts:* timing and probability. *Suggests:* the specific preventive action.

**5.3 Risk Detection / Risk Tespiti.** Continuous scan across financial, operational, compliance and satisfaction dimensions, producing a per-estate risk score with the contributing factors made explicit and weighted. *Why explicit:* an unexplained risk score is ignored; a decomposed one is acted upon.

**5.4 Financial Recommendations / Finansal Öneriler.** Identifies collection improvement opportunities, cost anomalies against portfolio peers, budget lines trending to overspend, and suppliers whose pricing has drifted. *Suggests:* reminder targeting, renegotiation candidates, budget reallocation.

**5.5 Maintenance Predictions / Bakım Tahminleri.** Per-asset failure probability at 30/60/90 days from age, service history, breakdown frequency and comparable assets across the portfolio. *Automates:* nothing in Sprint 01 — it proposes a work order which a human confirms.

**5.6 Resident Satisfaction Analysis / Memnuniyet Analizi.** Sentiment from request text, comments and survey responses, clustered into themes, trended per estate, with driver analysis identifying which operational metrics actually move satisfaction.

**5.7 Workload Analysis / İş Yükü Analizi.** Task and work-order distribution across staff and estates, surfacing both overload and idle capacity, with rebalancing suggestions. *Fairness safeguard:* presented at team level by default; individual comparison requires an explicit permission and is audited, because productivity data is easily misused.

**5.8 Staff Productivity / Personel Verimliliği.** Completion rates, average resolution time and first-time-fix rate by function, normalised for job complexity so that a technician handling hard jobs is not penalised for slower closure.

**5.9 Smart Notifications / Akıllı Bildirimler.** Learns which notifications each user acts on and which they dismiss, then reorders and batches accordingly. *Never suppresses:* severity-1 alerts, statutory deadlines and financial thresholds are exempt from all learning-based filtering — a hard rule, because a silenced critical alert is the worst possible failure of a smart system.

**5.10 Executive Briefing / Yönetici Brifingi.** A portfolio-level narrative: what moved, by how much, driven by which estates, and what decisions are pending. Generated daily, exportable as a board-ready PDF.

**5.11 AI Copilot / BN Copilot.** Ambient assistant on every tab, aware of current scope, time range and tab. Answers natural-language questions ("Yıldız Sitesi'nde bu ay kaç acil iş emri açıldı?") with a live, drillable result set rather than prose. Every answer shows its evidence records. Preserves and extends the Version 22 AI Chat panel, which remains available in its approved form.

---

# STEP 6 — DATA MODEL

## 6.1 Entities owned by the Dashboard module

**DashboardLayout** — `id · userId · roleId? · name · isTemplate · isDefault · scope · createdAt · updatedAt`
**WidgetInstance** — `id · layoutId · widgetKey · position{x,y,w,h} · config{} · refreshInterval · isVisible`
**WidgetCatalogItem** — `key · title · description · category · defaultSize · dataSource · requiredPermission · drillTarget · isCore` *(the four V22 widgets carry `isCore = true` and cannot be deleted from the catalogue)*
**KPIDefinition** — `key · name · description · formula · unit · domain · ownerId · favourableDirection · target · warningThreshold · criticalThreshold · refreshTier · sourceModule`
**KPISnapshot** — `id · kpiKey · scopeType · scopeId · periodStart · periodEnd · value · previousValue · targetValue · computedAt`
**SavedView** — `id · userId · name · tabKey · scope · timeRange · filters{} · isShared`
**AlertRule** — `id · name · kpiKey? · eventType? · condition · severity · audienceRoles[] · escalationMinutes · isActive · createdBy`
**AlertInstance** — `id · ruleId · severity · title · body · scopeType · scopeId · sourceModule · sourceRecordId · status · raisedAt · acknowledgedBy? · acknowledgedAt? · resolvedAt? · snoozeReason?`
**Insight** — `id · category · finding · impactValue · impactUnit · confidence · evidenceRefs[] · recommendedAction · scopeType · scopeId · status · generatedAt · reviewedBy? · dismissReason?`
**QuickActionDefinition** — `key · label · icon · targetModule · targetEndpoint · requiredPermission · formSchema · displayOrder`
**ActivityEvent** — `id · actorId · verb · objectType · objectId · scopeId · summary · occurredAt · visibilityPermission`
**DashboardPreference** — `userId · density · defaultTab · defaultScope · defaultTimeRange · autoRefresh · reducedMotion · theme`

## 6.2 Referenced entities (read-only — owned by other modules)

`Site · Blok · Daire · Sakin · Personel · IsEmri · Gorev · Bildirim · TakvimOlayi · AidatTahakkuk · Odeme · Demirbas · BakimKaydi · Olay · SakinTalebi · Rapor`

The Dashboard holds foreign keys and never writes to these tables directly. All writes go through the owning module's service layer.

## 6.3 Key relationships

```
User ──1:N──► DashboardLayout ──1:N──► WidgetInstance ──N:1──► WidgetCatalogItem
User ──1:1──► DashboardPreference
User ──1:N──► SavedView
KPIDefinition ──1:N──► KPISnapshot ──N:1──► Site (scope)
AlertRule ──1:N──► AlertInstance ──N:1──► Site
AlertInstance ──N:1──► (polymorphic sourceRecord: IsEmri | Olay | AidatTahakkuk | Demirbas)
Insight ──N:M──► evidence records (polymorphic, by reference only)
Site ──1:N──► Blok ──1:N──► Daire ──1:N──► Sakin
```

## 6.4 Status values

**AlertInstance.status** — `new` → `acknowledged` → `assigned` → `resolved` | `snoozed` | `expired`
**Insight.status** — `new` → `viewed` → `accepted` | `dismissed` | `expired`
**WidgetInstance runtime state** — `loading` | `ok` | `empty` | `error` | `stale` | `forbidden`
**KPI status** (derived, not stored) — `on_target` | `warning` | `critical` | `no_data` | `no_target`
**Scope type** — `portfolio` | `group` | `site` | `block`

## 6.5 Permissions

| Permission | Grants |
|---|---|
| `dashboard.view` | Open the Dashboard at all |
| `dashboard.scope.portfolio` | See portfolio-wide aggregates |
| `dashboard.operations.view` | Bugünün Operasyonu tab |
| `dashboard.ai.view` | AI İçgörüleri tab |
| `kpi.view` / `kpi.target.edit` / `kpi.definition.edit` | KPI Merkezi read / target / definition |
| `finance.summary.view` / `finance.debtor.view` | Aggregate finance / named debtors |
| `technical.summary.view` | Teknik Özet |
| `security.summary.view` / `security.sensitive.view` | Security overview / camera and access detail |
| `cleaning.summary.view` / `cleaning.inspect` | Cleaning overview / quality scoring |
| `personnel.summary.view` | Personel Durumu (aggregate only, never special-category data) |
| `resident.request.view` / `resident.request.respond` | Resident requests |
| `alert.acknowledge` / `alert.snooze` | Alert handling |
| `dashboard.layout.edit` / `dashboard.template.manage` | Personal layout / role templates |
| `report.generate` / `report.share` | Snapshot generation / distribution |

**Enforcement rule:** every permission is enforced server-side on the data query. Client-side hiding is a usability affordance only and is never the security boundary. Row-level scoping (which estates a user may see) is applied in the query layer, not the presentation layer.

## 6.6 Business rules

1. A KPI without a `target` renders no variance chip — never a fabricated or implied target.
2. `favourableDirection` is mandatory on every KPI; delta colouring is derived from it, never from the arithmetic sign.
3. An alert cannot be resolved from the Dashboard — only acknowledged, assigned or escalated. Resolution belongs to the owning module, so that resolution always carries the owning module's evidence requirements.
4. Snoozing a severity-1 alert requires a reason of at least 20 characters and is audited.
5. The Version 22 "Klasik" layout template cannot be deleted or modified; it can only be copied.
6. A widget the user lacks permission for is removed from the layout at render time and reported once in a consolidated notice — not rendered as a permission error per widget.
7. KPI snapshots are immutable once written; corrections create a new snapshot with a `supersedes` reference.
8. Portfolio aggregates exclude estates the user cannot access, and the surface states the effective scope explicitly ("12 siteden 12'si") so the user never mistakes a filtered aggregate for a complete one.
9. Stale data (older than 3× its refresh tier) must render as stale; it may never render as current.
10. Quick Actions execute through the owning module's endpoint; the Dashboard never writes directly to a business table.

---

# STEP 7 — API DESIGN

**Base:** `/api/v1/dashboard` · **Auth:** OAuth 2.0 Bearer (JWT, 15-minute access token, refresh rotation) · **Tenant:** resolved from token claims, never from a request parameter · **Errors:** RFC 7807 problem+json · **Correlation:** `X-Request-Id` echoed on every response

| # | Method & path | Purpose | Key inputs | Output | Permission |
|---|---|---|---|---|---|
| 1 | `GET /summary` | Everything the first paint needs, in one call | `scope`, `scopeId`, `range`, `tab` | KPIs + alerts + layout + freshness | `dashboard.view` |
| 2 | `GET /kpis` | KPI values with trend | `keys[]`, `scope`, `range`, `compare` | KPI array with sparkline series | `kpi.view` |
| 3 | `GET /kpis/{key}/definition` | Formula, owner, freshness | — | Definition object | `kpi.view` |
| 4 | `PATCH /kpis/{key}/target` | Set or change a target | `target`, `effectiveFrom` | Updated definition | `kpi.target.edit` |
| 5 | `GET /kpis/{key}/drill` | Records behind a KPI | `scope`, `range`, `page`, `sort` | Paginated record list | inherited from source module |
| 6 | `GET /alerts` | Active alerts | `severity`, `scope`, `status` | Alert array | `dashboard.view` |
| 7 | `POST /alerts/{id}/acknowledge` | Acknowledge | — | Updated alert | `alert.acknowledge` |
| 8 | `POST /alerts/{id}/snooze` | Snooze with reason | `until`, `reason` (≥20 chars) | Updated alert | `alert.snooze` |
| 9 | `POST /alerts/{id}/assign` | Assign to a user | `assigneeId`, `note` | Updated alert | `alert.acknowledge` |
| 10 | `GET /insights` | Ranked AI insights | `scope`, `category`, `limit` | Insight array with evidence refs | `dashboard.ai.view` |
| 11 | `POST /insights/{id}/accept` | Convert to task | `assigneeId`, `dueDate` | Created task reference | `dashboard.ai.view` + `task.create` |
| 12 | `POST /insights/{id}/dismiss` | Dismiss with reason | `reason` | Updated insight | `dashboard.ai.view` |
| 13 | `POST /ai/summary` | Generate daily summary | `scope`, `range`, `role` | Narrative text + evidence refs | `dashboard.ai.view` |
| 14 | `POST /ai/ask` | Copilot natural-language query | `question`, `context` | Answer + result set + evidence | `dashboard.ai.view` |
| 15 | `GET /layouts` | User layouts and templates | — | Layout array | `dashboard.view` |
| 16 | `PUT /layouts/{id}` | Save layout | `widgets[]`, `name` | Updated layout | `dashboard.layout.edit` |
| 17 | `POST /layouts/{id}/reset` | Reset to "Klasik" V22 default | — | Restored layout | `dashboard.layout.edit` |
| 18 | `GET /widgets/catalog` | Available widgets for this user | `category` | Catalogue array, permission-filtered | `dashboard.view` |
| 19 | `GET /widgets/{key}/data` | Single widget payload | `scope`, `range`, `config` | Widget data + freshness | widget's `requiredPermission` |
| 20 | `GET /activity` | Recent activity feed | `scope`, `types[]`, `cursor` | Cursor-paginated events | `dashboard.view` |
| 21 | `GET /today` | Today's operations bundle | `scope` | Schedule, coverage, attendance, incidents | `dashboard.operations.view` |
| 22 | `GET /search` | Command palette search | `q`, `types[]`, `limit` | Grouped results | `dashboard.view` |
| 23 | `GET /quick-actions` | Available actions for this user | — | Action definitions with form schemas | `dashboard.view` |
| 24 | `POST /snapshots` | Generate an export | `tab`, `scope`, `range`, `format` | Job id, then download URL | `report.generate` |
| 25 | `GET /preferences` · `PUT /preferences` | Read / write user preferences | Preference object | Preference object | self |
| 26 | `WS /stream` | Real-time alerts and counters | subscribe by scope | Event frames | `dashboard.view` |

**Security controls on every endpoint.** TLS 1.3 · tenant isolation asserted in the query layer and covered by automated tests on every build · row-level scope filter applied before aggregation · rate limits (600 req/min per user, 60 req/min on AI endpoints) · idempotency keys required on all POST that create records · request and response logging with PII redaction · full audit entry on every acknowledge, snooze, target change and export.

**Performance contract.** `GET /summary` p95 ≤ 400ms served from cache · widget endpoints p95 ≤ 250ms · drill endpoints p95 ≤ 600ms · AI endpoints stream, first token ≤ 1.5s · WebSocket delivery ≤ 2s from event.

---

# STEP 8 — VALIDATIONS

## 8.1 Required fields

| Context | Required | Rule |
|---|---|---|
| Save layout | `name`, ≥1 widget | Name 3–50 chars, unique per user |
| Set KPI target | `target`, `effectiveFrom` | Numeric, within ±500% of trailing 12-period mean, else warning |
| Snooze alert | `until`, `reason` | Reason ≥20 chars; `until` ≤ 72 hours ahead |
| Assign alert | `assigneeId` | Assignee must hold access to the alert's scope |
| Dismiss insight | `reason` | One of a fixed set, or free text ≥10 chars |
| Quick Action: work order | `siteId`, `category`, `priority`, `title` | Title ≥5 chars; priority from the frozen V22 set (Acil/Orta/Düşük) |
| Custom time range | `from`, `to` | `from` < `to`; span ≤ 24 months; `to` ≤ today |
| Export | `format`, `scope` | Format ∈ {pdf, xlsx, png} |

## 8.2 Permission rules

- Every request is authorised server-side against the effective scope; a client-supplied `scopeId` outside the user's grant returns `403`, never an empty `200` — silent filtering hides authorisation bugs.
- Widgets the user cannot access are stripped from the layout response and reported once in aggregate.
- Named debtor data requires `finance.debtor.view`; without it, aggregate figures render and the drill action is hidden rather than shown-and-blocked.
- Personnel special-category data (health-related absence reason) is never returned by any Dashboard endpoint at any permission level.
- Delegated approval respects the original approver's limits, never the delegate's.
- Segregation of duties: a user cannot approve a request they raised; blocked with an explanatory message, not a generic error.

## 8.3 Duplicate prevention

- Identical alerts (same rule, same scope, same source record) within a 15-minute window collapse into one instance with an occurrence count.
- Quick Action creations require an idempotency key; a repeated submission returns the original record instead of creating a second.
- Duplicate resident reports of the same fault in the same block within 60 minutes are flagged as probable duplicates for merge (proposal only, never automatic).
- Layout names are unique per user; a collision offers "(2)" rather than failing.
- Double-click protection on every mutating control: disabled immediately on first activation until the response resolves.

## 8.4 Business validations

1. A time range longer than 24 months is rejected — the aggregation cost is unbounded and the analytical value belongs in the Analytics module.
2. Comparison periods must be of equal length; unequal comparison is refused with an explanation rather than silently normalised.
3. A KPI target more than 500% from its trailing mean raises a confirmation warning ("Bu hedef son 12 dönem ortalamasının 6 katı. Emin misiniz?").
4. Scope changes that would return zero accessible estates are blocked with an explanatory empty state rather than an empty dashboard.
5. Financial figures are never displayed without a period label and an "as of" timestamp.
6. Percentage KPIs are validated to 0–100 unless explicitly flagged as an index.
7. A collection rate above 100% is possible (advance payments) and must not be rejected — it is annotated instead, since a naive validation here would produce a false error at month-end every year.
8. Widget refresh intervals below 30 seconds are rejected to protect backend load.

## 8.5 Warnings (non-blocking)

- "Bu görünümde 12 siteden 3'ü gösteriliyor" whenever an aggregate is scope-filtered.
- "Veriler 14:32 itibarıyla" whenever data exceeds its freshness tier.
- "Bazı veriler yüklenemedi" on partial failure, naming the failed sources.
- "Bu KPI'ın hedefi tanımlı değil" instead of a fabricated variance.
- "AI önerisi — insan onayı gerektirir" on every AI-generated recommendation.
- "Bu dönem henüz tamamlanmadı" when comparing a partial period against a complete one — the most common cause of false alarm on any dashboard.

## 8.6 Error handling

| Case | Behaviour |
|---|---|
| Widget data source fails | Widget-local error card with retry; all other widgets unaffected |
| Auth token expired | Silent refresh; on failure, modal re-authentication preserving unsaved state |
| Insufficient permission | Explanatory message naming the required permission and how to request it |
| Network offline | Offline banner; cached values shown, marked stale; mutations queued and replayed |
| AI service unavailable | AI regions degrade to a neutral message; every non-AI capability continues untouched |
| Aggregation timeout | Partial results with an explicit "hesaplama tamamlanamadı" notice; never a silently truncated number |
| Concurrent layout edit | Last-write-wins with a conflict notice offering the discarded version |
| Rate limit exceeded | Backoff with countdown; auto-refresh suspended, manual refresh remains available |

Every error surfaces a correlation ID and a single clear next action. No error message in this module ever reads "Bir hata oluştu" alone.
