# BN Yönetim — Finance & Accounting Module
## Sprint 03 · Enterprise Implementation Specification (STEP 1 – STEP 8)

**Module:** Finance & Accounting (only)
**Baseline:** Version 22 frozen · Sprint 01 Dashboard and Sprint 02 AI Center approved and untouched
**Mode:** Extension. Design system, navigation and component library locked.

---

# 0. SCOPE AMENDMENT — a Sprint 01 non-goal reopened

In the Sprint 01 Dashboard specification I wrote:

> *"BN Yönetim does not become a general-ledger accounting system; it integrates with the customer's accounting software rather than replacing it."*

That statement was correct about **the management company's own commercial books** and wrong about **the estates**. Under Turkish condominium law the site yönetimi is itself an accounting entity: it must prepare an işletme projesi (KMK m.37), keep an işletme defteri, produce a gelir-gider tablosu, and present it to the kat malikleri kurulu for discharge, with a denetçi report. A module that only records "payments received" cannot produce a defensible gelir-gider tablosu, and a facility management organisation cannot run 150 estates on a spreadsheet bridge.

**Amended scope, stated precisely:**

| Layer | Owner |
|---|---|
| Estate operational finance — tahakkuk, tahsilat, gider, bütçe, kasa, banka, cari | **This module.** Full double-entry subledger sufficient for işletme defteri and gelir-gider tablosu |
| Statutory e-document issuance (e-Fatura / e-Arşiv / e-Makbuz) | **This module**, via a GİB-integrated provider |
| The management company's own commercial ledger, corporate tax, muhtasar, KDV beyannamesi | **External accounting package** (Logo, Mikro, Netsis) via integration |
| Payroll calculation, SGK filings | **External payroll**; this module consumes the result as an expense posting |

So: a real double-entry subledger for the estates, an integration boundary for the management company's own books. This is the amendment; everything below assumes it.

---

# STEP 1 — MODULE ANALYSIS

## 1.1 Module purpose

Finance & Accounting is the **financial backbone**: it originates every receivable, records every payment, controls every expenditure, and produces the statements that a kat malikleri kurulu, a denetçi and a commercial client all rely on.

Three properties distinguish it from every other module in the platform:

1. **It is the only module where a mistake costs money directly.** A wrong work order wastes an hour; a wrong tahakkuk multiplied across 25.000 units is a legal problem. Every design decision below privileges correctness over convenience.
2. **It must be audit-ready at rest, not on request.** Immutable journals, period locks, segregation of duties and a complete audit trail are structural, not features.
3. **It is legally constrained.** Dues apportionment, late-payment interest, budget approval and enforcement escalation are governed by the Kat Mülkiyeti Kanunu and the estate's yönetim planı. The module encodes those rules as configurable policy, never as hard-coded assumptions.

## 1.2 Primary users

| Role | Turkish label | Primary need | Landing |
|---|---|---|---|
| Accountant | Muhasebe | Daily posting, reconciliation, invoice entry | Nakit & Banka |
| Finance Manager | Finans Müdürü | Position, variance, approvals, forecasting | Finans Panosu |
| Estate Manager | Site Yöneticisi | Collection status, expenditure requests, unit balances | Tahakkuk & Tahsilat |
| Portfolio Manager | Portföy Yöneticisi | Cross-estate comparison, consolidated position | Finans Panosu |
| Auditor | Denetçi | Read-only everything, immutable trail, statements | Raporlar |
| Board Member | Yönetim Kurulu Üyesi | Approvals above threshold, budget adoption | Giderler |
| Executive | Üst Yönetim | Portfolio financial health, management company P&L | Finans Panosu |
| System Administrator | Sistem Yöneticisi | Chart of accounts, policies, integrations, period control | Ayarlar & Denetim |

**Never a user of this module:** residents. Residents reach their own balance and statement through the Resident Portal (V29) via a read-only, unit-scoped projection. No resident touches this module.

## 1.3 Daily workflows

**08:30 — Muhasebe.** Opens Nakit & Banka. Imports the overnight bank statement. 38 of 42 credits auto-match by IBAN and reference code; four require manual matching in the reconciliation workspace. Two are partial payments, allocated oldest-debt-first per policy. Closes with the reconciliation difference at zero.

**10:00 — Site Yöneticisi.** Reviews an overdue list. Twelve units passed the 60-day threshold; the module has already computed statutory interest. Issues the second-stage notice in bulk; three units at 90+ days are handed to legal collection with an auto-assembled evidence pack.

**11:30 — Muhasebe.** A contractor invoice arrives as e-Fatura. It matches work order #4821. The amount exceeds the approved ceiling by 9.7%, so posting is blocked and the invoice routes to approval with the variance stated.

**14:00 — Finans Müdürü.** Approves three expenditures. One is blocked by segregation of duties — the same person raised it. Reviews budget variance: maintenance is 21.5% over and landscaping 18.9% over; opens both.

**Month end — Muhasebe + Finans Müdürü.** Runs the period-close checklist: unreconciled items zero, suspense account zero, accruals posted, depreciation posted, subledger-to-control-account agreement verified. Locks the period. Generates the gelir-gider tablosu and unit statements.

**Annual — Yönetim + Denetçi.** Drafts next year's işletme projesi from actuals, contracted commitments and asset replacement schedules. Board approves; the module derives per-unit dues by the estate's apportionment rule and generates the year's tahakkuk schedule.

## 1.4 Financial lifecycle

```
BUDGET            İşletme projesi drafted → board approves → dues rate derived
   ↓
ASSESSMENT        Tahakkuk generated per unit on the billing calendar
   ↓                    (this is where a receivable is born)
NOTIFICATION      Statement issued → resident notified (Communication module)
   ↓
COLLECTION        Payment received → matched → allocated → receipt issued
   ↓                    ↘ unpaid → ageing → interest accrual → notice ladder
   ↓                              → legal collection (icra) with evidence pack
COMMITMENT        Expenditure requested → approved → purchase order
   ↓
LIABILITY         Invoice received → 3-way matched → approved → payable
   ↓
DISBURSEMENT      Payment scheduled → executed → bank reconciled
   ↓
CLOSE             Accruals → reconciliation → subledger agreement → period lock
   ↓
REPORT            Gelir-gider tablosu · denetçi pack · board pack · statements
```

Every arrow is a state transition with a permission, a validation and an audit entry. No transition can be skipped, and no transition can be reversed — only compensated by a new entry.

## 1.5 Integration with Dashboard (Sprint 01)

The Dashboard **reads** from this module and never writes to it. Specifically it consumes: the `tahsilat` KPI (%94, target %96), `gecikme` (₺1.284.500), `nakit` (₺4.860.000), the Aylık Aidat Tahsilatı chart series, the Finansal Özet tab content, and the ageing summary. The Dashboard's `finance.summary.view` and `finance.debtor.view` permissions, already defined in Sprint 01, are honoured here as the same grants — not re-implemented.

**Contract:** if the Dashboard and this module disagree about a number, this module is correct by definition and the Dashboard has a bug. Dashboard figures are projections of these records, computed by the same aggregation service.

## 1.6 Integration with AI Center (Sprint 02)

The AI Center **proposes**; this module **decides and executes**. Every AI capability touching money enters through this module's own API, under the user's permission, with the human named as the accountable party — exactly the contract Sprint 02 specified.

| AI Center capability | What this module receives |
|---|---|
| Financial Advisor / Finansal Danışman | Collection forecast, cost outliers, draft işletme projesi — all as proposals |
| Collection Agent (authority 2) | Drafted reminder text and segmentation; a human sends |
| Document Agent (authority 2) | Extracted invoice fields with per-field confidence; a human corrects and accepts |
| Recommendations | e.g. "reactivate the dormant reminder ladder" — accepted through the workflow module |
| Anomaly detection | Flags on expense lines; the flag never blocks posting on its own, it routes to review |
| Fraud signals | Raised as an alert; only a human suspends a payment |

**Hard rule inherited from Sprint 02 and enforced here:** no AI-originated figure ever posts to a ledger. AI may explain a number, draft a narrative, or propose an entry for human acceptance. The posting is always a human act with a named accountable user.

## 1.7 Integration with Reports

This module owns financial report *definitions* and hands rendering, scheduling and distribution to the Reports module. Statutory packs — gelir-gider tablosu, işletme projesi karşılaştırması, borç-alacak listesi, kasa ve banka raporu, denetçi eki — are versioned report definitions owned here. Every distributed report is archived exactly as sent, because a figure disputed at an owners' assembly must be reproducible.

## 1.8 Integration with Resident Management

Residents are the counterparties of nearly every receivable. This module reads unit and resident data (owner vs. tenant, arsa payı, occupancy dates) and writes back nothing except balance projections consumed by the Resident Portal.

Two domain rules that must not be simplified:

1. **Debt follows the unit, not the person.** Under KMK m.22 the malik is liable; a departing tenant does not extinguish the unit's arrears. The data model therefore attaches the receivable to the **Daire**, with the responsible party recorded separately and historically.
2. **Owner and tenant may split liability** per the yönetim planı — typically the tenant pays operating dues and the owner pays capital and reserve contributions. The apportionment policy handles this; it is not a manual workaround.

## 1.9 Business value

- **Collection rate is the highest-leverage metric in the domain.** Two points across a 25.000-unit portfolio is a very large sum flowing directly to estate liquidity.
- **Automated reconciliation removes the single most tedious recurring labour** in estate accounting — matching hundreds of bank credits per estate per month.
- **Expense intelligence recovers money quietly lost** to duplicate invoicing, price drift and out-of-scope line items.
- **Audit readiness shortens the annual assembly** from a dispute into a review, and materially strengthens the management company's position at contract renewal.
- **Statutory correctness reduces legal exposure** — wrongly computed interest or improperly apportioned dues are the most common sources of litigation against site management.

---

# STEP 2 — SUBMODULE DESIGN

Twenty-eight submodules: the twenty required, plus eight (✚) that the domain and enterprise operation make necessary. Each specifies Purpose, Users, Permissions, Inputs, Outputs, Business Rules and Business Value.

---

### 2.1 Financial Dashboard / Finans Panosu
**Purpose.** Financial position of the selected scope in one screen.
**Users.** All finance roles, executives, auditors.
**Permissions.** `finance.summary.view`.
**Inputs.** Posted transactions, budget, ageing, cash balances.
**Outputs.** Six KPIs (collection rate, arrears, cash, budget variance, reserve fund, DSO), collection chart with budget and prior-year overlays, ageing distribution, exception list.
**Business rules.** Every figure carries a period label and an "as of" timestamp. Unposted and draft entries are excluded and the exclusion is stated. Partial periods are labelled.
**Business value.** Removes the delay between a financial problem occurring and a human seeing it.

### 2.2 Income Management / Gelir Yönetimi
**Purpose.** Every inflow other than dues: rent from common areas, advertising, car park fees, facility hire, interest income, penalty income.
**Users.** Muhasebe, Finans Müdürü.
**Permissions.** `finance.income.view` / `.post`.
**Inputs.** Income type, counterparty, period, amount, VAT, cost centre.
**Outputs.** Income register, recurring income schedule, income by category and estate.
**Business rules.** Income posts to the estate that earned it, never to the portfolio. Recurring income generates accruals. Rent income triggers stopaj (withholding) where applicable.
**Business value.** Common-area income is routinely under-collected because nobody owns it; giving it a register makes it visible.

### 2.3 Expense Management / Gider Yönetimi
**Purpose.** Every outflow, from its request to its payment.
**Users.** Muhasebe, Site Yöneticisi, Finans Müdürü.
**Permissions.** `finance.expense.view` / `.request` / `.post`.
**Inputs.** Category, vendor, amount, VAT, tevkifat, cost centre, work order link, documents.
**Outputs.** Expense register, commitment vs. actual, category analysis, vendor spend.
**Business rules.** An expense must carry a budget line. Expenditure without an approved budget line is blocked, not warned. Expenses above threshold require approval before posting. Every expense links to its supporting document.
**Business value.** Uncontrolled expenditure is the fastest way for an estate to exhaust its liquidity mid-year.

### 2.4 Budget Management / İşletme Projesi ve Bütçe
**Purpose.** The statutory annual operating budget as a first-class object.
**Users.** Finans Müdürü, Site Yöneticisi, Yönetim Kurulu, Denetçi.
**Permissions.** `finance.budget.view` / `.draft` / `.approve`.
**Inputs.** Prior actuals, contracted commitments, asset replacement schedule, inflation assumption, reserve target.
**Outputs.** Draft işletme projesi by category, derived per-unit dues by apportionment rule, board approval record, continuous budget-vs-actual variance.
**Business rules.** A budget is not effective until board approval is recorded with date and resolution reference. An approved budget is immutable; changes create a revision with justification. Dues derive from the budget, never the reverse.
**Business value.** The işletme projesi is a legal instrument; producing it correctly and on time is a compliance obligation, not an administrative nicety.

### 2.5 Cash Flow / Nakit Akışı
**Purpose.** Liquidity, forward-looking.
**Users.** Finans Müdürü, executives.
**Permissions.** `finance.cash.view`.
**Inputs.** Balances, receivable ageing, scheduled payables, recurring commitments, forecast collection.
**Outputs.** Thirteen-week rolling view per estate and consolidated, minimum-balance projection, shortfall warnings.
**Business rules.** Reserve fund is displayed separately and never counted as operating liquidity. Forecast collection uses a confidence band, never a point estimate.
**Business value.** An estate that cannot pay its staff on time loses its staff.

### 2.6 Bank Accounts / Banka Hesapları
**Purpose.** Register of every account, per estate.
**Users.** Muhasebe, Finans Müdürü, Denetçi.
**Permissions.** `finance.bank.view` / `.manage`.
**Inputs.** Bank, branch, IBAN, account type, currency, signatories, purpose.
**Outputs.** Account register, balances, movement, signatory matrix.
**Business rules.** Every estate's funds are segregated; commingling across estates is architecturally prevented, not merely discouraged. Reserve fund accounts are flagged and restricted. IBAN changes require dual authorisation and a cooling period — this is the single most common fraud vector in property management.
**Business value.** Fund segregation is a legal requirement and the first thing any denetçi tests.

### 2.7 Collections / Tahsilat
**Purpose.** Turning receivables into cash.
**Users.** Muhasebe, Site Yöneticisi.
**Permissions.** `finance.collection.view` / `.manage`.
**Inputs.** Payments from bank, POS, DBS, cash; allocation rules.
**Outputs.** Collection register, allocation detail, receipt issuance, collection rate by estate and period.
**Business rules.** Allocation follows the estate's documented policy — default oldest-debt-first, interest before principal, unless the yönetim planı says otherwise. Manual allocation override requires a reason and is audited. Over-collection is permitted and posts as advance, never rejected.
**Business value.** Allocation policy determines how quickly old debt clears and how interest accrues; automating it correctly is worth more than chasing harder.

### 2.8 Payment Tracking / Ödeme Takibi
**Purpose.** Every inbound payment from initiation to posting.
**Users.** Muhasebe.
**Permissions.** `finance.payment.view`.
**Inputs.** POS transactions, bank credits, DBS collections, cash receipts.
**Outputs.** Payment register with channel, status, matching state, fee, settlement date.
**Business rules.** Settlement date and posting date are distinct and both retained — POS money arrives days after the resident pays. Reversals and chargebacks create compensating entries, never deletions.
**Business value.** Residents who paid but appear unpaid generate the angriest support calls in this business.

### 2.9 Accounts Receivable / Alacaklar
**Purpose.** The receivable book.
**Users.** Muhasebe, Finans Müdürü, Site Yöneticisi, Denetçi.
**Permissions.** `finance.ar.view`; unit-level debtor identity requires `finance.debtor.view`.
**Inputs.** Tahakkuk, payments, adjustments, interest accrual.
**Outputs.** Ageing (0–30 / 31–60 / 61–90 / 90+), per-unit balances, interest accrued, provision analysis.
**Business rules.** Receivables attach to the **Daire**; the liable party is recorded historically. Interest accrues per policy (default KMK m.20/c, 5% monthly) and is shown separately from principal. Write-off requires board resolution reference.
**Business value.** Ageing is the earliest reliable indicator of an estate's financial trajectory.

### 2.10 Accounts Payable / Borçlar
**Purpose.** The liability book.
**Users.** Muhasebe, Finans Müdürü.
**Permissions.** `finance.ap.view` / `.schedule`.
**Inputs.** Approved invoices, recurring commitments, payroll postings, statutory obligations.
**Outputs.** Payable ageing, due schedule, payment run proposal, vendor balances.
**Business rules.** No payable is created without an approved invoice. Payment runs require dual authorisation above threshold. Early-payment discounts and late-payment penalties are computed and surfaced.
**Business value.** Missed statutory payment deadlines carry penalties that are entirely avoidable.

### 2.11 Resident Account Statements / Sakin Hesap Ekstresi
**Purpose.** The single authoritative view of one unit's financial position.
**Users.** Muhasebe, Site Yöneticisi; projected read-only to the resident via the portal.
**Permissions.** `finance.statement.view`; cross-unit access requires `finance.debtor.view`.
**Inputs.** Tahakkuk, payments, interest, adjustments, agreements.
**Outputs.** Chronological statement with running balance, downloadable PDF, bulk generation and distribution.
**Business rules.** A statement is generated as of a stated date and archived exactly as issued. Corrections appear as new lines, never as edits to issued statements.
**Business value.** Most dues disputes end the moment a correct, itemised statement is produced.

### 2.12 Vendor Management / Tedarikçi Yönetimi
**Purpose.** Who the estate pays, and whether it should.
**Users.** Muhasebe, Finans Müdürü, Site Yöneticisi.
**Permissions.** `finance.vendor.view` / `.manage`.
**Inputs.** Vendor identity (VKN/TCKN), bank details, tax status, insurance and certification validity, rate card.
**Outputs.** Vendor register, spend analysis, performance score (from Sprint 01 SLA data), document expiry alerts.
**Business rules.** Bank detail changes require dual authorisation, a cooling period and out-of-band verification. Vendors with expired mandatory insurance are blocked from new commitments. Duplicate VKN is prevented.
**Business value.** Vendor bank-detail fraud is the highest-value single attack against property management organisations.

### 2.13 Contracts / Sözleşmeler
**Purpose.** Committed spend, before it becomes an invoice.
**Users.** Finans Müdürü, Site Yöneticisi, Denetçi.
**Permissions.** `finance.contract.view` / `.manage`.
**Inputs.** Party, scope, value, period, escalation clause, penalty, renewal and notice dates.
**Outputs.** Contract register, commitment schedule, renewal calendar, contract-vs-invoice variance.
**Business rules.** An invoice referencing a contract is validated against its rate and remaining value. Auto-renewal dates raise alerts ahead of the notice deadline.
**Business value.** Contracts that renew silently at drifted prices are a permanent, invisible cost.

### 2.14 Invoice Management / Fatura Yönetimi
**Purpose.** Inbound and outbound invoices with statutory compliance.
**Users.** Muhasebe.
**Permissions.** `finance.invoice.view` / `.post`.
**Inputs.** e-Fatura / e-Arşiv inbound, manual entry, AI-extracted fields with confidence.
**Outputs.** Invoice register, three-way match state, VAT and tevkifat breakdown, GİB status.
**Business rules.** Three-way match (purchase approval ↔ receipt/work order ↔ invoice) before posting. Duplicate detection on vendor + invoice number + date + amount. Amount above the approved ceiling blocks posting and routes to approval. VAT rates validated against the service type.
**Business value.** Three-way matching is the control that stops paying for work that was never done.

### 2.15 Receipt Management / Makbuz ve Dekont
**Purpose.** Evidence of money received.
**Users.** Muhasebe, Site Yöneticisi.
**Permissions.** `finance.receipt.issue`.
**Inputs.** Payment record, payer, allocation.
**Outputs.** Sequentially numbered receipt, e-Makbuz where applicable, delivery record.
**Business rules.** Receipt numbering is gapless and sequential per estate per year. Cancellation issues a cancellation record; numbers are never reused.
**Business value.** Gapless numbering is a primary audit test; failing it puts the whole ledger in question.

### 2.16 Expense Approval Workflow / Gider Onay Akışı
**Purpose.** Nobody spends alone.
**Users.** All finance roles, board members.
**Permissions.** `finance.expense.request` / `finance.approve.tier1..3`.
**Inputs.** Request, amount, justification, budget line, quotes.
**Outputs.** Approval chain state, decision record, delegation trail, SLA on decisions.
**Business rules.** Thresholds per estate (e.g. ≤ ₺5.000 manager; ≤ ₺50.000 finance manager; above that board resolution). Segregation of duties: the requester cannot approve. Delegation respects the *original* approver's limit. Step-up authentication above threshold. Emergency expenditure permits post-hoc approval within a fixed window, flagged and reported.
**Business value.** This is the control that a denetçi examines first and that protects the manager personally.

### 2.17 Financial Reports / Finansal Raporlar
**Purpose.** Statutory and management reporting.
**Users.** All finance roles, denetçi, board, executives.
**Permissions.** `finance.report.view` / `report.share`.
**Outputs.** Gelir-gider tablosu · işletme projesi karşılaştırması · borç-alacak listesi · kasa ve banka raporu · mizan (trial balance) · yaşlandırma · tedarikçi harcama · denetçi eki · yıl sonu kapanış paketi.
**Business rules.** Every report states scope, period, basis (cash or accrual) and generation timestamp. Distributed reports are archived byte-identical to what was sent.
**Business value.** The board pack stops being three days of manual assembly.

### 2.18 Tax & Compliance / Vergi ve Uyum
**Purpose.** Statutory obligations tracked, not remembered.
**Users.** Muhasebe, Finans Müdürü, Denetçi.
**Permissions.** `finance.tax.view` / `.manage`.
**Inputs.** VAT on income and expense, tevkifat, stopaj on rent, damga vergisi on contracts, obligation calendar.
**Outputs.** Tax position, obligation calendar with deadlines, e-document status, filing evidence register.
**Business rules.** Rates are configuration, never code — they change. Missed deadlines escalate automatically. Filing evidence is retained for the statutory period.
**Business value.** Tax penalties in this domain are small individually and substantial across 150 estates.

### 2.19 Audit Logs / Denetim Kaydı
**Purpose.** Reconstructable history of every financial act.
**Users.** Denetçi, administrators, security.
**Permissions.** `finance.audit.view`.
**Outputs.** Immutable log: actor, timestamp, entity, before/after values, approval chain, IP, device, correlation ID; filterable and exportable.
**Business rules.** Append-only. Corrections create new entries referencing the original. Retention per statutory requirement (10 years).
**Business value.** Without this the module is unauditable, and an unauditable finance system is unusable in this domain.

### 2.20 Financial Settings / Finansal Ayarlar
**Purpose.** Policy, not preference.
**Users.** Administrators, Finans Müdürü.
**Permissions.** `finance.settings.manage`.
**Inputs.** Chart of accounts, apportionment rules, interest policy, approval thresholds, fiscal calendar, numbering series, allocation policy, rounding rules.
**Outputs.** Effective policy set with version history and effective dates.
**Business rules.** Policy changes are versioned with an effective date and never retroactive. Changing an apportionment rule mid-period requires explicit confirmation and is audited.
**Business value.** Every estate is different; hard-coding one estate's rules makes the other 149 wrong.

---

### ✚ 2.21 Dues Assessment / Tahakkuk Yönetimi
**Purpose.** Where receivables are born — the most consequential process in the module.
**Permissions.** `finance.assessment.view` / `.generate` / `.reverse`.
**Inputs.** Approved budget, unit register, arsa payı, apportionment rule, billing calendar, occupancy dates.
**Outputs.** Per-unit tahakkuk lines, generation run record, preview before commit, reversal with compensating entries.
**Business rules.** Generation is a **two-phase commit**: preview with totals and unit count, then explicit confirmation. Re-running the same period is blocked. Mid-period ownership changes apportion by day. A generation run is reversible only in whole, never per line, and reversal is a compensating posting.
**Business value.** A wrong tahakkuk run touches every unit simultaneously; two-phase commit is the control that prevents it.

### ✚ 2.22 Bank Reconciliation / Banka Mutabakatı
**Purpose.** The ledger agrees with the bank, provably.
**Permissions.** `finance.reconcile.perform`.
**Inputs.** Bank statement (MT940, CSV, API), ledger entries.
**Outputs.** Auto-match by IBAN and reference, exception queue, reconciliation statement with difference, sign-off record.
**Business rules.** A period cannot close with a non-zero unexplained reconciliation difference. Suspense account balance must be zero at close. Manual matches require a reason.
**Business value.** This is the control that makes every other number believable.

### ✚ 2.23 Reserve Fund / Yenileme Fonu
**Purpose.** Capital reserve, protected from operating use.
**Permissions.** `finance.reserve.view` / `.disburse`.
**Outputs.** Reserve balance, contribution schedule, planned drawdown against the asset replacement plan, adequacy analysis.
**Business rules.** Disbursement requires board resolution reference. Reserve funds are excluded from operating liquidity everywhere in the module.
**Business value.** Under-reserved estates face special assessments, which are the most contentious event in condominium life.

### ✚ 2.24 Legal Collection / İcra ve Yasal Takip
**Purpose.** Structured escalation beyond reminders.
**Permissions.** `finance.legal.view` / `.initiate`.
**Inputs.** Aged debt, notice history, delivery evidence, board authorisation.
**Outputs.** Evidence pack (statement, notices with delivery proof, interest calculation, board resolution), case register, cost tracking, recovery outcome.
**Business rules.** Initiation requires board authorisation and a complete evidence pack. Legal costs attach to the unit where recoverable. Case status feeds the provision analysis.
**Business value.** Cases fail on missing delivery evidence far more often than on the merits.

### ✚ 2.25 Petty Cash / Kasa Yönetimi
**Purpose.** Physical cash, controlled.
**Permissions.** `finance.cash.handle` / `.count`.
**Outputs.** Cash book, float register, count records with variance, replenishment.
**Business rules.** Counts are recorded with the counter's identity; variance above tolerance escalates. Cash balance can never be negative.
**Business value.** Small, frequent, high-risk — cash is where the informal losses happen.

### ✚ 2.26 Payroll Interface / Bordro Arayüzü
**Purpose.** Consume payroll results without becoming a payroll system.
**Permissions.** `finance.payroll.post`.
**Inputs.** Approved payroll from the external system, cost allocation by estate.
**Outputs.** Payroll expense postings, SGK and tax payable, per-estate labour cost.
**Business rules.** Individual salary detail is never displayed in this module — only aggregate cost by estate and function. This is a KVKK special-category boundary and is enforced server-side.
**Business value.** Labour is the largest line in most estate budgets; it must be allocable per estate without exposing personal data.

### ✚ 2.27 Period Close / Dönem Kapanışı
**Purpose.** A defined, checkable end to each period.
**Permissions.** `finance.period.close` / `.reopen`.
**Outputs.** Close checklist with pass/fail per control, lock record, reopening record with justification.
**Business rules.** Close blocks on: unreconciled bank items, non-zero suspense, unposted approved invoices, subledger-to-control disagreement, draft assessments. A locked period rejects all postings; reopening requires elevated permission and writes an audit entry.
**Business value.** Without period locks, historical figures change silently and every prior report becomes unreliable.

### ✚ 2.28 Multi-Currency / Döviz (future-ready)
**Purpose.** Architectural readiness, not a shipped feature.
**Permissions.** `finance.fx.manage`.
**Outputs.** Currency register, rate source and history, transaction currency vs. functional currency, revaluation.
**Business rules.** Every monetary amount is stored as `{amount, currency, fxRate, functionalAmount}` from day one, with TRY as functional currency and rate 1. Retrofitting currency onto a scalar money column is one of the most expensive refactors in financial software — so it is not deferred, only unused.
**Business value.** Commercial units and foreign owners already transact in EUR and USD; the model is ready when the UI is needed.

---

# STEP 3 — SCREEN DESIGN

## 3.1 Layout

Sprint 01 shell unchanged: 240px sidebar with the ten frozen items, sticky header, 12-column grid. Finance occupies a module workspace reached from the approved navigation; an eleven-tab strip using the approved tab component organises the twenty-eight submodules.

A **finance context bar** sits below the header, always visible: scope (estate), fiscal period with lock state, functional currency, and the posting basis. Financial figures are meaningless without these four facts, so they are never more than one glance away.

## 3.2 Dashboard cards and KPIs

Six KPIs on the approved card composition: Tahsilat Oranı (%94, target %96), Gecikmiş Alacak (₺1.284.500), Nakit Pozisyon (₺4.860.000), Bütçe Sapması (+%4,2), Yenileme Fonu (₺2.140.000), Ortalama Tahsil Süresi / DSO (34 gün). Each carries trend, target, favourability direction and drill-through — the Sprint 01 KPI contract, unchanged.

## 3.3 Tables

The approved table component with finance-specific conventions: all monetary columns right-aligned with tabular numerals and two decimals; negative values in one unambiguous treatment; debit and credit as separate columns, never a signed single column; a **running balance** column on ledger and statement views; column totals in a sticky footer; drill from any line to its source document.

## 3.4 Charts

Approved chart grammar. Finance-specific compositions: **collection bar chart** with budget line and prior-year overlay (the frozen Version 22 chart, extended in Sprint 01, reused here unchanged); **ageing stacked bar**; **cash flow projection line** with confidence band and minimum-balance threshold; **budget variance horizontal bars** diverging from zero with over/under colouring from the approved semantic ramp.

## 3.5 Filters and advanced search

Scope, period, status, category, vendor, amount range, document type, posting state. Advanced search supports amount ranges, date ranges, reference and document number, and free text across counterparty names. Saved filters. All active filters render as removable chips — no hidden filter state, consistent with Sprints 01 and 02.

## 3.6 Bulk operations

Bulk tahakkuk generation (two-phase, preview then commit) · bulk statement generation and distribution · bulk reminder issuance · bulk payment matching · bulk approval within the approver's limit · bulk export. Every bulk operation shows an affected-count preview and requires explicit confirmation; every one is reversible or compensable.

## 3.7 Forms

Money inputs enforce two decimals, thousands separators, currency, and reject negatives where the business rule forbids them. Journal entry forms show a **live debit/credit balance indicator** that blocks submission until balanced. Date inputs validate against the open period. Every form shows which budget line will be charged before submission.

## 3.8 Dialogs

Assessment preview and commit · approval decision with justification · reconciliation match confirmation · period close checklist · reversal with compensating entry preview · vendor bank change with dual authorisation · write-off with resolution reference · export.

## 3.9 Notifications

Approval requests · threshold breaches · budget overrun warnings before overspend · reconciliation differences · statutory deadlines · failed payment runs · vendor detail changes. Financial notifications are exempt from the AI Center's learned filtering, per the Sprint 02 hard rule.

## 3.10 States

**Loading** — skeletons matching final geometry; KPIs first.
**Empty** — distinguished by cause: no data yet (new estate, offers setup) · no results for filter · nothing outstanding (the good empty state: "Vadesi geçmiş alacak yok").
**Error** — per-surface with correlation ID; a failed widget never blocks the rest.
**Locked period** — a distinct designed state, not an error: posting controls disabled with a clear explanation and the lock date.
**Unbalanced** — a distinct state on journal forms with the difference shown.
**Stale** — figures dim with an "as of" chip when past their refresh tier.

## 3.11 Responsive layout

≥1440px full ledger with running balance · 1024–1439 ledger scrolls horizontally within bounds · 768–1023 sidebar collapses to the frozen toggle, tables prioritise date/counterparty/amount · <768 tables become stacked cards preserving amount prominence; approval actions remain full-width and thumb-reachable, because approving from a phone is a real and frequent workflow.

## 3.12 Accessibility

Approved ARIA tab pattern with roving tabindex · money values announced with currency, not just digits · debit/credit distinguished by column and label, never colour alone · variance direction stated in text as well as colour · charts with data-table alternatives · forms with `aria-invalid` and linked errors · balance indicator as an `aria-live` region so screen-reader users hear the entry balance as it changes · `prefers-reduced-motion` · 44px targets · Turkish `lang`.

---

# STEP 4 — BUSINESS FLOW

**4.1 Income flow.** Income event → category and cost centre → VAT/stopaj computed → posted to the earning estate → receivable or immediate cash → reconciled → reflected in gelir-gider tablosu.

**4.2 Expense flow.** Need identified → budget line checked (block if absent) → request with justification and quotes → approval by threshold → commitment recorded → goods/service received → invoice three-way matched → posted as payable → scheduled → paid → reconciled.

**4.3 Collection flow.** Tahakkuk generated → statement issued → reminder ladder (T-7, T-0, T+7, T+30) → payment received via bank/POS/DBS/cash → matched by IBAN and reference → allocated oldest-first, interest before principal → receipt issued → unpaid balance ages → interest accrues → 60-day formal notice → 90-day board authorisation → legal collection with evidence pack.

**4.4 Payment flow.** Approved payable → payment run proposal → dual authorisation above threshold → bank file or manual execution → confirmation → posting → reconciliation → vendor balance updated.

**4.5 Approval flow.** Request → threshold routing → segregation-of-duties check (requester ≠ approver) → step-up authentication above threshold → decision with mandatory justification → delegation respects the original approver's limit → audit entry → notification → SLA clock on pending decisions.

**4.6 Budget flow.** Prior actuals + commitments + replacement schedule + inflation → draft → review → board approval with resolution reference → effective → dues derived by apportionment rule → continuous variance tracking → threshold breach opens a review task → revision requires justification and creates a new version.

**4.7 Invoice flow.** e-Fatura inbound or manual entry → AI extraction with per-field confidence (Sprint 02) → human correction → duplicate check → three-way match → variance check against contract and approved ceiling → block or route to approval → post → schedule.

**4.8 Vendor flow.** Onboarding with VKN verification and document collection → insurance and certification validity → rate card → contract → performance monitoring from Sprint 01 SLA data → periodic review → bank detail changes under dual authorisation with cooling period.

**4.9 Audit flow.** Every state transition writes: actor, timestamp, entity, before/after, approval chain, IP, device, correlation ID. Append-only. Period close snapshots control totals. Auditor access is read-only and itself audited.

**4.10 Notification flow.** Financial event → classification → permission filter → **exempt from learned filtering** (Sprint 02 hard rule) → delivery → acknowledgement → escalation if a threshold or statutory deadline goes unacknowledged.

---

# STEP 5 — AI FINANCE FEATURES

All of these are delivered **by the AI Center** (Sprint 02) and consumed here. None writes to a ledger; each ends in a human decision with a named accountable user.

**5.1 Financial Copilot.** Natural-language questions answered with live, drillable result sets: *"Deniz Sitesi'nde 90 günden uzun süredir ödenmemiş daireler"* returns a filterable, exportable list with evidence, not a paragraph.

**5.2 Budget Prediction.** Drafts next period's işletme projesi from actuals, contracted commitments, asset replacement schedules and an explicit inflation assumption. Every assumption is stated and adjustable; the draft is a proposal requiring board approval.

**5.3 Cash Flow Forecast.** Thirteen-week projection with a confidence band, decomposed into expected collection, scheduled payables and recurring commitments, with the drivers of any projected shortfall named.

**5.4 Collection Risk Prediction.** Per-unit likelihood of late payment from history, ageing, seasonality and behaviour segment. Used to **target reminder intensity**, never to penalise — the distinction matters legally and ethically, and is enforced by policy.

**5.5 Expense Anomaly Detection.** Flags price deviation against estate history and portfolio peers, duplicate submission, out-of-scope line items, unusual timing and round-number patterns. A flag routes to review; it never blocks a posting on its own authority.

**5.6 Late Payment Prediction.** Forecasts which units will miss the coming cycle, enabling pre-emptive contact before arrears form.

**5.7 Budget Optimisation.** Identifies categories where the estate pays materially above portfolio median for comparable service levels, with renegotiation candidates ranked by recoverable value.

**5.8 Vendor Performance Analysis.** Combines Sprint 01 SLA data with spend: cost per job, first-time-fix, rework rate, price trend — producing an evidence base for renewal negotiations.

**5.9 Automatic Financial Summary.** Plain-Turkish narrative attached to every statement and report, explaining variance rather than restating it.

**5.10 Executive Financial Briefing.** Portfolio-level daily narrative: what moved, which estates drove it, what decision is pending. Board-ready export.

**5.11 AI Collection Recommendations.** Ranked, quantified proposals — reactivate a dormant reminder ladder, adjust ladder timing for a segment, offer a payment plan to a specific cohort — each with expected recovery and confidence.

**5.12 Financial Health Score.** Composite per estate: collection performance, liquidity, budget discipline, reserve adequacy, arrears trajectory. Weighting fully transparent and decomposable in one click.

**5.13 Cost Optimisation Suggestions.** Consolidation opportunities across estates, contract timing, energy and consumable optimisation, with quantified savings.

**5.14 Fraud Detection.** Signals on: vendor bank detail changes, invoices just below approval thresholds, duplicate invoice patterns, unusual approval timing, payments to newly created vendors, round-amount clustering, and same-actor request-and-approve attempts. **Every signal raises an alert for human investigation; the system never suspends a payment autonomously.**

---

# STEP 6 — DATA MODEL

## 6.1 Money representation

```
Money = { amount: decimal(18,4), currency: char(3),
          fxRate: decimal(18,8), functionalAmount: decimal(18,4) }
```

Decimal, never float. Currency present from day one with TRY functional and rate 1. This is non-negotiable: floating-point money and scalar currency columns are the two defects that cannot be fixed later without a full migration.

## 6.2 Core entities

**FinancialAccount** — `id · estateId · code · name · type(asset|liability|equity|income|expense) · parentId · isReserve · isControl · currency · isActive`
**JournalEntry** — `id · estateId · entryNo · date · periodId · description · sourceType · sourceId · postedBy · postedAt · reversalOfId? · isBalanced · status(draft|posted|reversed)`
**JournalLine** — `id · entryId · accountId · debit(Money) · credit(Money) · costCentreId · unitId? · vendorId? · description`
**Period** — `id · estateId · year · month · startDate · endDate · status(open|closing|locked) · lockedBy? · lockedAt? · reopenReason?`
**Budget** — `id · estateId · year · status(draft|approved|revised) · approvedBy · approvalDate · resolutionRef · version · previousVersionId?`
**BudgetLine** — `id · budgetId · accountId · category · annualAmount(Money) · monthlyDistribution[] · notes`
**Assessment** — `id · estateId · periodId · runNo · apportionmentRule · totalAmount(Money) · unitCount · status(preview|committed|reversed) · generatedBy · committedAt · reversalOfId?`
**AssessmentLine** — `id · assessmentId · unitId · liablePartyId · baseAmount(Money) · shareBasis · shareValue · dueDate · status`
**Receivable** — `id · estateId · unitId · sourceType(assessment|penalty|interest|legal_cost|other) · sourceId · originalAmount(Money) · outstanding(Money) · dueDate · ageBucket · interestAccrued(Money) · status(open|partial|settled|written_off|in_legal)`
**Payment** — `id · estateId · channel(bank|pos|dbs|cash|transfer) · payerId · unitId? · amount(Money) · fee(Money) · paymentDate · settlementDate · reference · bankTxnId? · status(pending|settled|reversed|chargeback) · receiptId?`
**PaymentAllocation** — `id · paymentId · receivableId · amount(Money) · allocationType(auto|manual) · reason? · allocatedBy`
**Receipt** — `id · estateId · series · number · paymentId · issuedTo · issuedAt · isCancelled · cancellationOf?` *(gapless per estate per year)*
**Invoice** — `id · estateId · direction(inbound|outbound) · vendorId? · invoiceNo · invoiceDate · dueDate · netAmount(Money) · vatAmount(Money) · withholdingAmount(Money) · grossAmount(Money) · workOrderId? · contractId? · matchState(unmatched|two_way|three_way) · eDocType · eDocStatus · status(draft|pending_approval|approved|posted|paid|rejected|cancelled)`
**Payable** — `id · estateId · invoiceId · vendorId · outstanding(Money) · dueDate · scheduledDate? · status`
**PaymentRun** — `id · estateId · runDate · totalAmount(Money) · itemCount · preparedBy · authorisedBy[] · status`
**Vendor** — `id · legalName · vkn · taxOffice · bankAccounts[] · insuranceExpiry · certifications[] · rateCardId? · isBlocked · blockReason? · performanceScore`
**VendorBankChange** — `id · vendorId · oldIban · newIban · requestedBy · requestedAt · verifiedBy? · verificationMethod · effectiveAt · coolingPeriodEnds`
**Contract** — `id · estateId · vendorId · title · value(Money) · startDate · endDate · noticeDate · escalationClause · penaltyClause · autoRenew · status · consumedValue(Money)`
**BankAccount** — `id · estateId · bankName · iban · accountType · currency · isReserve · signatories[] · openingBalance(Money) · currentBalance(Money) · isActive`
**BankTransaction** — `id · bankAccountId · valueDate · amount(Money) · description · counterpartyIban? · reference · reconciliationState(unmatched|matched|suspense) · matchedEntryId?`
**Reconciliation** — `id · bankAccountId · periodId · statementBalance(Money) · ledgerBalance(Money) · difference(Money) · unmatchedCount · performedBy · signedOffBy? · status`
**PettyCash** — `id · estateId · custodianId · float(Money) · balance(Money)` · **PettyCashCount** — `id · pettyCashId · countedBy · countedAt · countedAmount · variance · explanation?`
**ReserveFund** — `id · estateId · balance(Money) · targetBalance(Money) · contributionSchedule[] · plannedDrawdowns[]`
**LegalCase** — `id · estateId · unitId · initiatedAt · boardResolutionRef · claimAmount(Money) · costsIncurred(Money) · recoveredAmount(Money) · status · evidencePackRef`
**ApprovalRequest** — `id · estateId · subjectType · subjectId · amount(Money) · tier · requesterId · currentApproverId · chain[] · justification · status · slaDueAt · decidedAt?`
**TaxObligation** — `id · estateId · taxType · periodId · dueDate · amount(Money) · status · filingEvidenceRef?`
**FinancePolicy** — `estateId · apportionmentRule(equal|arsa_payi|m2|unit_type|mixed) · interestRate · interestBasis · allocationOrder · approvalThresholds[] · numberingSeries[] · roundingRule · fiscalCalendar · effectiveFrom · version`
**FinanceAuditEntry** — `id · correlationId · actorId · entity · entityId · action · beforeValue · afterValue · approvalChainRef? · ip · device · occurredAt` *(append-only)*

## 6.3 Key relationships

```
Estate ──1:N──► FinancialAccount ──1:N──► JournalLine ──N:1──► JournalEntry
Estate ──1:N──► Period ──1:N──► JournalEntry   (locked periods reject postings)
Budget ──1:N──► BudgetLine ──N:1──► FinancialAccount
Assessment ──1:N──► AssessmentLine ──1:1──► Receivable ──N:1──► Daire (unit)
Receivable ──1:N──► PaymentAllocation ──N:1──► Payment ──0:1──► Receipt
Vendor ──1:N──► Contract ──1:N──► Invoice ──1:1──► Payable ──N:1──► PaymentRun
BankAccount ──1:N──► BankTransaction ──0:1──► JournalEntry (matched)
Every mutation ──1:N──► FinanceAuditEntry
```

**The critical relationship:** `Receivable → Daire`, not `Receivable → Resident`. Debt follows the unit under KMK m.22; the liable party is recorded on the line and historically, so a tenant change never orphans or extinguishes arrears.

## 6.4 Statuses

**JournalEntry** `draft → posted → reversed` (never deleted)
**Assessment** `preview → committed → reversed`
**Receivable** `open → partial → settled | written_off | in_legal`
**Payment** `pending → settled | reversed | chargeback`
**Invoice** `draft → pending_approval → approved → posted → paid | rejected | cancelled`
**ApprovalRequest** `pending → approved | rejected | delegated | expired`
**Period** `open → closing → locked` (reopen is an audited exception)
**Reconciliation** `in_progress → balanced → signed_off`

## 6.5 Permissions

Read: `finance.summary.view · finance.income.view · finance.expense.view · finance.budget.view · finance.cash.view · finance.bank.view · finance.ar.view · finance.ap.view · finance.statement.view · finance.vendor.view · finance.contract.view · finance.invoice.view · finance.report.view · finance.tax.view · finance.audit.view · finance.debtor.view · finance.reserve.view · finance.legal.view`

Write: `finance.income.post · finance.expense.request · finance.expense.post · finance.assessment.generate · finance.assessment.reverse · finance.collection.manage · finance.receipt.issue · finance.invoice.post · finance.payment.execute · finance.reconcile.perform · finance.budget.draft · finance.budget.approve · finance.vendor.manage · finance.contract.manage · finance.reserve.disburse · finance.legal.initiate · finance.cash.handle · finance.payroll.post · finance.tax.manage · finance.period.close · finance.period.reopen · finance.settings.manage · finance.fx.manage`

Approve: `finance.approve.tier1 (≤ ₺5.000) · tier2 (≤ ₺50.000) · tier3 (board, unlimited)`

**Enforcement.** Server-side on the query and on the transition. Row-level estate scoping applied before aggregation. Segregation of duties evaluated at decision time, not at request time.

---

# STEP 7 — API DESIGN

**Base:** `/api/v1/finance` · **Auth:** OAuth 2.0 Bearer (JWT, 15-min access, refresh rotation) · **Tenant and estate scope:** from token claims plus explicit `estateId`, validated against the grant · **Errors:** RFC 7807 · **Idempotency:** required on every mutating endpoint · **Audit:** every call writes an entry with the correlation ID

| # | Method & path | Purpose | Key input | Output | Permission | Limit |
|---|---|---|---|---|---|---|
| 1 | `GET /summary` | Dashboard payload | `estateId`, `periodId` | KPIs, ageing, cash, variance | `finance.summary.view` | 120/min |
| 2 | `GET /accounts` · `POST /accounts` | Chart of accounts | account body | Account | `finance.settings.manage` | 60/min |
| 3 | `POST /journal-entries` | Post an entry | lines[], date, description | Entry | `finance.expense.post` | 60/min |
| 4 | `POST /journal-entries/{id}/reverse` | Compensating reversal | `reason` | New entry | `finance.expense.post` | 30/min |
| 5 | `GET /trial-balance` | Mizan | `estateId`, `periodId` | Account balances with control totals | `finance.report.view` | 30/min |
| 6 | `POST /assessments/preview` | Tahakkuk dry run | `periodId`, `rule` | Totals, unit count, per-unit preview | `finance.assessment.generate` | 10/min |
| 7 | `POST /assessments/commit` | Commit the run | `previewId`, `idempotencyKey` | Assessment + receivables | `finance.assessment.generate` | 5/min |
| 8 | `POST /assessments/{id}/reverse` | Whole-run reversal | `reason` | Compensating entries | `finance.assessment.reverse` | 5/min |
| 9 | `GET /receivables` | AR book | `estateId`, `bucket`, `unitId`, `cursor` | Paginated receivables | `finance.ar.view` | 120/min |
| 10 | `GET /receivables/ageing` | Ageing | `estateId`, `asOf` | Bucketed totals | `finance.ar.view` | 60/min |
| 11 | `POST /payments` | Record a payment | channel, amount, unitId, reference | Payment + allocations | `finance.collection.manage` | 120/min |
| 12 | `POST /payments/{id}/allocate` | Manual allocation | allocations[], `reason` | Allocations | `finance.collection.manage` | 60/min |
| 13 | `POST /payments/{id}/reverse` | Reversal / chargeback | `reason` | Compensating entries | `finance.collection.manage` | 30/min |
| 14 | `POST /receipts` | Issue receipt | `paymentId` | Receipt with gapless number | `finance.receipt.issue` | 120/min |
| 15 | `GET /statements/{unitId}` | Unit statement | `from`, `to`, `format` | Statement with running balance | `finance.statement.view` | 120/min |
| 16 | `POST /statements/bulk` | Bulk generation | `estateId`, `asOf`, `deliver` | Job id | `finance.statement.view` | 5/min |
| 17 | `GET /invoices` · `POST /invoices` | Invoice register / entry | filters / invoice body | Invoices | `finance.invoice.view` / `.post` | 120/min |
| 18 | `POST /invoices/{id}/match` | Three-way match | `workOrderId`, `contractId` | Match state + variance | `finance.invoice.post` | 60/min |
| 19 | `POST /expense-requests` | Raise expenditure | amount, budgetLineId, justification | Approval request | `finance.expense.request` | 60/min |
| 20 | `POST /approvals/{id}/decide` | Approve / reject | `decision`, `justification`, `stepUpToken?` | Updated request | `finance.approve.tierN` | 60/min |
| 21 | `GET /payables` · `POST /payment-runs` | AP and disbursement | filters / items[] | Payables / run | `finance.ap.view` / `finance.payment.execute` | 60/min |
| 22 | `POST /payment-runs/{id}/authorise` | Dual authorisation | `stepUpToken` | Run status | `finance.payment.execute` | 30/min |
| 23 | `POST /bank/import` | Statement import | file (MT940/CSV) or API sync | Import summary | `finance.reconcile.perform` | 20/min |
| 24 | `GET /bank/reconciliation` · `POST /bank/match` | Reconcile | `bankAccountId`, matches[] | Reconciliation state | `finance.reconcile.perform` | 120/min |
| 25 | `GET /budgets` · `POST /budgets` · `POST /budgets/{id}/approve` | Budget lifecycle | budget body / `resolutionRef` | Budget | `finance.budget.view/.draft/.approve` | 60/min |
| 26 | `GET /cash-flow` | 13-week projection | `estateId`, `weeks` | Series with confidence band | `finance.cash.view` | 60/min |
| 27 | `GET /vendors` · `POST /vendors` · `POST /vendors/{id}/bank-change` | Vendor lifecycle | vendor / IBAN change | Vendor / change request | `finance.vendor.manage` | 60/min |
| 28 | `POST /vendors/{id}/bank-change/{cid}/verify` | Out-of-band verification | `method`, `verifierId` | Change effective date | `finance.vendor.manage` (second actor) | 30/min |
| 29 | `GET /contracts` · `POST /contracts` | Contracts | filters / contract | Contracts | `finance.contract.view/.manage` | 60/min |
| 30 | `GET /reserve` · `POST /reserve/disburse` | Reserve fund | `amount`, `resolutionRef` | Reserve state | `finance.reserve.view/.disburse` | 30/min |
| 31 | `POST /legal-cases` | Initiate enforcement | `unitId`, `resolutionRef` | Case + evidence pack | `finance.legal.initiate` | 20/min |
| 32 | `GET /petty-cash` · `POST /petty-cash/count` | Cash book | `countedAmount` | Balance, variance | `finance.cash.handle` / `.count` | 60/min |
| 33 | `POST /payroll/post` | Payroll posting | aggregate cost by estate | Entries | `finance.payroll.post` | 20/min |
| 34 | `GET /tax/obligations` | Tax calendar | `estateId`, `from`, `to` | Obligations | `finance.tax.view` | 60/min |
| 35 | `GET /period-close/checklist` · `POST /period-close` · `POST /period-reopen` | Close control | `periodId`, `reason` | Checklist / lock record | `finance.period.close` / `.reopen` | 20/min |
| 36 | `GET /reports/{key}` · `POST /reports/{key}/export` | Statutory reports | `estateId`, `periodId`, `format` | Report / export job | `finance.report.view` | 60/min |
| 37 | `GET /audit` | Financial audit trail | filters, cursor | Entries | `finance.audit.view` | 60/min |
| 38 | `GET /policy` · `PUT /policy` | Finance policy | policy with `effectiveFrom` | Policy version | `finance.settings.manage` | 30/min |
| 39 | `GET /fx/rates` · `PUT /fx/rates` | Currency rates | source, rates[] | Rates | `finance.fx.manage` | 60/min |

**Security.** TLS 1.3 · estate-level row scoping applied before aggregation · segregation of duties evaluated server-side at decision time · step-up authentication required above configured thresholds · dual authorisation on payment runs and vendor bank changes · idempotency keys on all mutations · immutable audit with before/after values · PCI-DSS scope avoided entirely (card data never touches platform infrastructure) · numeric responses as decimal strings, never floats.

**Performance.** `GET /summary` p95 ≤ 400ms cached · receivable list p95 ≤ 500ms at 25.000 units · assessment preview for 500 units ≤ 8s asynchronous with progress · statement generation ≤ 2s per unit, bulk asynchronous · reconciliation auto-match for 500 transactions ≤ 15s.

---

# STEP 8 — VALIDATIONS

## 8.1 Required fields

| Context | Required | Rule |
|---|---|---|
| Journal entry | date, description, ≥2 lines, balanced | Date within an open period; debit total = credit total exactly |
| Journal line | account, debit **or** credit (not both) | Amount > 0; account must be active and postable |
| Expense request | amount, budget line, justification, category | Justification ≥ 20 characters; budget line must exist and be active |
| Invoice | vendor, invoice number, date, net, VAT, gross | Gross = net + VAT − withholding, validated to the kuruş |
| Payment | channel, amount, date, payer or unit | Amount > 0; date not in the future beyond settlement tolerance |
| Assessment run | period, apportionment rule, budget reference | Budget must be approved; period must be open |
| Vendor | legal name, VKN, tax office, IBAN | VKN checksum validated; IBAN format and country validated |
| Budget approval | resolution reference, approval date | Reference non-empty; date not in the future |
| Period close | all checklist controls passed | No override path exists for a failed control |
| Write-off | resolution reference, reason | Both mandatory |

## 8.2 Business rules

1. **Double-entry always balances.** An unbalanced entry cannot be submitted; the UI blocks and the API rejects.
2. **Locked periods reject everything.** No posting, amendment or deletion in a locked period, at any permission level. Reopening is a separate, audited, elevated action.
3. **Nothing is deleted.** Corrections are compensating entries referencing the original.
4. **Expenditure requires an approved budget line.** Absent line blocks the request rather than warning.
5. **Assessment is two-phase.** Preview then explicit commit; re-running a committed period is blocked.
6. **Assessment reversal is whole-run only.** Per-line reversal would silently break apportionment integrity.
7. **Allocation follows documented policy.** Manual override requires a reason and is audited.
8. **Interest is computed, never entered.** Rate and basis come from policy with effective dates; historical accruals are never recomputed retroactively.
9. **Receipt numbering is gapless per estate per year.** Cancellations issue a cancellation record; numbers are never reused.
10. **Reserve funds are never operating liquidity.** Excluded from every cash and coverage figure.
11. **Estate funds never commingle.** Cross-estate transfer requires an explicit inter-estate transaction with authorisation on both sides.
12. **Debt attaches to the unit.** Ownership change transfers liability per policy and never extinguishes the balance.
13. **AI never posts.** Proposals only; a named human commits.

## 8.3 Duplicate prevention

Invoice: vendor + invoice number is unique; near-duplicate (same vendor, ±3 days, same amount) warns and requires acknowledgement · Payment: bank transaction ID unique; same amount, same unit, same day warns · Assessment: one committed run per estate per period, enforced by unique constraint · Vendor: VKN unique · Receipt: series + number unique · Idempotency keys prevent double submission on retry · Double-click protection on every mutating control.

## 8.4 Balance validation

Debit = credit on every entry · subledger totals agree with control accounts before close · bank ledger balance vs. statement balance difference must be zero or fully explained by identified timing items · petty cash can never be negative · unit balance = Σ receivables − Σ allocations, recomputed and compared on statement generation · reserve balance reconciles to its dedicated bank account.

## 8.5 Budget validation

Category totals equal the budget total · derived per-unit dues summed across units equal the budgeted collectible, within the configured rounding tolerance, with the rounding difference explicitly allocated · commitment plus actual against a line warns at 90% and blocks new commitments at 100% unless overridden by a tier-appropriate approver with justification · a revision cannot reduce a line below its already-committed value.

## 8.6 Permission rules

Estate scoping applied server-side before aggregation; an out-of-grant `estateId` returns `403`, never a filtered `200` · unit-level debtor identity requires `finance.debtor.view` and the drill action is hidden, not shown-and-blocked, without it · individual salary data is unreachable at every permission level · auditors are read-only by role, and their access is itself audited · approval tier is checked at decision time because permissions can change between request and decision.

## 8.7 Approval rules

Threshold routing per estate policy · **segregation of duties: the requester can never approve their own request**, including via delegation · delegation respects the original approver's limit, not the delegate's · step-up authentication above the configured amount · emergency expenditure permits post-hoc approval within a fixed window, flagged and reported separately · unacknowledged approvals escalate on an SLA clock · every decision requires a justification and records identity, timestamp, IP and device.

## 8.8 Financial controls

Vendor bank-detail change requires a second actor, out-of-band verification and a cooling period before it takes effect · payment runs above threshold require dual authorisation · invoices within 5% below an approval threshold are flagged for review (threshold-splitting detection) · payments to vendors created within 30 days are flagged · round-amount clustering is flagged · same-day request-and-approve by related actors is flagged · all flags route to a human; **no control autonomously suspends a payment.**

## 8.9 Error handling

| Case | Behaviour |
|---|---|
| Unbalanced entry | Submission blocked; difference displayed live in an `aria-live` region |
| Locked period | Distinct designed state naming the lock date and who locked it |
| Budget line exhausted | Blocked with the remaining balance and the override path named |
| Duplicate invoice | Blocked with a link to the existing record |
| Segregation-of-duties breach | Blocked with the specific rule named, not a generic error |
| Reconciliation difference at close | Close blocked with the unmatched items listed |
| Bank import format error | Names the failing line and the expected format |
| Payment gateway failure | Idempotent retry; in-flight transactions reconciled, never double-posted |
| Statement generation failure | Partial results discarded entirely — a partial statement is worse than none |
| Concurrent edit | Optimistic locking with a conflict notice showing both versions |

## 8.10 Warnings (non-blocking)

"Bu dönem henüz tamamlanmadı" on partial-period comparison · "Bütçe kaleminin %90'ı kullanıldı" before the block engages · "Bu tutar onay eşiğinin %5 altında" on threshold-splitting suspicion · "Tedarikçi banka bilgisi 12 gün önce değişti" on payment preparation · "Yenileme fonu hedefin %64'ünde" on reserve adequacy · "3 banka hareketi eşleşmedi" before close · "Bu tahsilat oranı avans ödemeler nedeniyle %100'ü aşıyor" — a legitimate condition that must be annotated, never rejected.
