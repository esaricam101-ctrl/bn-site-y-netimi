# BN Yönetim — Finance & Accounting Module
## STEP 10 Quality Review & STEP 11 Validation Report

**Sprint:** 03 · Finance & Accounting (single module)
**Artifact:** `bn-finance.html` — 109.3 KB, single file, zero JavaScript dependencies
**Baseline:** Version 22 frozen · Sprint 01 Dashboard and Sprint 02 AI Center untouched
**Date:** 25 July 2026

---

# 0. SCOPE AMENDMENT — recorded, not buried

Sprint 01 stated that BN Yönetim "does not become a general-ledger accounting system." Sprint 03 reopens that boundary deliberately, because it was correct about the management company's own books and wrong about the estates: under Turkish condominium law a site yönetimi is itself an accounting entity that must produce an işletme projesi, keep an işletme defteri and present a gelir-gider tablosu for discharge.

**Amended:** this module owns a full double-entry subledger for the estates. It does **not** own the management company's commercial ledger, corporate tax filings or payroll calculation — those remain integrations. The amendment is stated in section 0 of the specification so a future reader finds the reasoning, not just the reversal.

---

# STEP 10 — QUALITY REVIEW

Nine defects found in my own implementation. All nine fixed. Two would have thrown or rendered incorrectly in a browser.

| # | Dimension | Defect | Fix |
|---|---|---|---|
| F1 | Consistency | Two export buttons (`Ekstre → PDF`, `Denetim → Dışa aktar`) were emitted without a closing `</button>`. Browsers auto-close, but the following content nests *inside* the button, making entire table headers part of an interactive control and destroying the accessible name | Both closed; whole-document balance re-verified |
| F2 | Business logic | The vendor row handler used the selector `"[data-vnd])"` — a malformed CSS selector. `closest()` throws a `SyntaxError` on an invalid selector, so **the first click on any vendor row would have killed the entire delegated click handler**, silently disabling every interaction on the page | Selector corrected |
| F3 | Consistency | The chart's budget line used `calc(22px + X% * 0.01 * (100% - 36px))` — multiplying a percentage by a percentage is invalid CSS, so the declaration is dropped and the line falls to the axis. A financial reference line silently rendering in the wrong place is worse than one that is obviously broken | Computed in pixels against the known bar area (174px) |
| F4 | Business logic | The reconciliation banner displayed "Fark ₺0,00" while simultaneously reporting four unmatched items. The difference was arithmetically zero because the unmatched pairs happened to be equal — technically true, practically misleading, and exactly the kind of number that makes an accountant stop trusting a system | Relabelled to unmatched value; the close-checklist description aligned to match |
| F5 | Business logic | The approval dialog's budget-line row contained a nonsense expression (`fmt(kurus(...) > 0 ? 0 : kurus(0))`) that always rendered ₺0,00 | Replaced with a real budget lookup showing utilisation, remaining balance and an over-limit warning when the request exceeds it |
| F6 | Code quality | Dead variable in the assessment panel | Removed |
| F7 | Business logic | The Alacaklar tab counter was hardcoded to 4 while the panel it summarises reports 7 units ready for legal collection — a header contradicting its own content | Aligned to the data |
| F8 | Security | Period lock was enforced only by a `disabled` attribute on buttons. A disabled attribute is a UI affordance, not a control: the command palette, keyboard activation or any future code path reaches the handler directly | Lock guard added inside the handlers for assessment preview, assessment commit and journal posting |
| F9 | Business logic | Journal posting checked debit = credit only when rendering the button's disabled state, not when handling the click | Balance re-checked in the handler before posting |

F2 and F8 are the two worth dwelling on. F2 is a single stray character that would have made the module appear completely inert after one click — the kind of defect that survives casual review because everything looks right in the source. F8 is the more instructive one: I had implemented a financial control as a visual state. In a finance module, every control has to exist at the point where the action happens, not at the point where the button is drawn.

## 10.1 Dimension verdicts after fixes

**Enterprise UX.** Eleven tabs on the locked tab component. A permanently visible finance context bar carrying the four facts that make any figure meaningful — scope, period, lock state, basis and currency. Every table has a totals footer; every panel closes with an "as of" line stating scope, period, basis and currency.

**Financial workflows.** Two-phase assessment with a typed confirmation. Live debit/credit balance blocking submission. Segregation of duties blocking the approver who raised the request, with the rule named. Three-way invoice matching that blocks posting on a ceiling breach. Reconciliation matcher that refuses unequal amounts. Period close that cannot be overridden. Vendor IBAN change requiring a second actor, out-of-band verification and a cooling period.

**Accessibility.** Locked ARIA tab pattern; balance indicator and reconciliation banner as `role="status"` live regions so screen-reader users hear the entry balance change; ageing bar as `role="img"` with a full text label; chart with a data-table alternative; table captions and `tfoot` totals; `aria-pressed` on reconciliation selection; `aria-invalid` with linked errors on every validated field; keyboard row activation; reduced-motion; skip link; Turkish `lang`.

**Performance.** No JavaScript libraries, no CSS framework, one inline sprite, one external request (DM Sans). 109 KB single document.

**Consistency.** The Sprint 01/02 component library CSS is included **byte-identical** — verified programmatically, not asserted. Only new compositions were appended: context bar, money cell, ledger columns, balance indicator, ageing bar, variance bars, cash-flow projection, reconciliation matcher, approval chain, close checklist, three-way match.

**Business logic.** Money is handled in integer kuruş throughout; the single `parseFloat` is user input parsing, immediately converted to integer. Debit and credit are separate columns, never a signed value. Interest is policy-derived, not entered. Reserve funds are excluded from every liquidity figure. Debt is stated as attaching to the unit under KMK m.22.

**Security.** Segregation of duties, step-up authentication above threshold, dual authorisation with cooling period on vendor bank changes, typed confirmation on irreversible mass operations, append-only audit, period lock guards in handlers.

**Integration.** Dashboard KPIs (%94, ₺1.284.500, ₺4.860.000) and the Version 22 collection chart series are reproduced exactly as Sprint 01 consumes them. AI Center involvement is framed correctly everywhere: the invoice panel states that fields were extracted by the Document Agent at 89% confidence, verified by a human, and that **no AI output can post to a ledger**.

---

# STEP 11 — VALIDATION REPORT

## 11.1 Completed features

**Structure.** Eleven tabs covering twenty-eight specified submodules · finance context bar with scope picker and period lock state · command palette indexing sections, financial operations and estates.

**Financial controls implemented as working code, not description:**
- Double-entry balance indicator that disables posting and re-checks in the handler
- Two-phase assessment: preview with unit count, total and rounding difference, then a confirmation requiring the word TAHAKKUK typed
- Segregation of duties: the seeded request raised by the signed-in user is blocked with the rule named and cannot be approved
- Approval with mandatory ≥20-character justification, step-up notice above ₺50.000, and live budget-line utilisation
- Reconciliation matcher with selection, equality validation and refusal of unequal amounts; clearing the queue flips the close checklist control
- Period close blocked by any failed control, with per-control remediation, then lock; reopening requires an elevated, reason-gated dialog
- Three-way match showing a 9.7% ceiling breach that blocks posting and routes to approval
- Vendor IBAN change showing all three outstanding controls (second verifier, out-of-band verification, 72-hour cooling)
- Vendor blocked for expired mandatory insurance, with existing debts still payable

**Financial surfaces.** Six KPIs · Version 22 collection chart with budget and prior-year overlays plus data table · ageing distribution · budget variance with diverging bars, 90% warning and 100% block · reserve fund shown separately from liquidity · 13-week cash projection with confidence band and minimum threshold · unit statement with running balance and totals footer · payables schedule · vendor and contract registers with notice-date warnings · tax obligation calendar · financial audit log with per-entry detail.

**Domain correctness.** KMK m.20/c interest, KMK m.22 unit-attached debt, KMK m.37 işletme projesi with board resolution reference, arsa payı apportionment, gapless receipt numbering, e-Fatura/e-Arşiv/e-Makbuz status, tevkifat and stopaj, legal collection evidence pack, estate fund segregation.

## 11.2 Missing features (honest inventory)

**Specified in STEPS 1–8 but not implemented in this artifact:**
- Journal entry *composition* (lines are seeded; there is no add-line/edit-line editor)
- Chart of accounts management, trial balance (mizan) rendering
- Income Management as its own surface (specified; only referenced)
- Petty cash counts, payroll posting, multi-currency UI (model-ready, no screen)
- Bank statement import (MT940/CSV parsing), payment run creation and dual authorisation
- Bulk operations beyond assessment: bulk statements, bulk reminders, bulk approval
- Advanced search, saved filters, column management, list virtualisation
- Contract-to-invoice rate validation, provision analysis, write-off flow
- Report rendering — the catalogue lists eight statutory reports; export is a stub

**Not implementable in a static artifact:** server-side estate scoping, transactional integrity, immutable audit persistence, idempotency, step-up authentication, decimal arithmetic in a database, GİB integration, bank APIs.

## 11.3 Future improvements

Near term: journal line editor with account lookup · trial balance · bank import parser · payment runs with dual authorisation · bulk statement generation · report rendering.
Medium term: provision and write-off workflow · contract rate validation · multi-currency screens · advanced search and saved filters.
Roadmap-aligned: automated arrears escalation (V24 workflow) · AI budget drafting accepted into this module (V25/V28) · consolidated portfolio financial position (V26/V33).

## 11.4 Enterprise readiness

Multi-site scoping, fund segregation, approval hierarchy with thresholds, role-based permissions, audit trail, export paths and executive KPIs are all present as design and largely as behaviour. Multi-currency is architecturally ready — every monetary value is defined as `{amount, currency, fxRate, functionalAmount}` in the model and handled as integer kuruş in code — which is the one decision that genuinely cannot be retrofitted cheaply.

## 11.5 Financial readiness

The invariants that make a finance module trustworthy are implemented rather than described: balanced entries, no deletion, period locks enforced in handlers, two-phase mass operations, segregation of duties, gapless numbering, reserve segregation, policy-derived interest. What is missing is breadth (many surfaces are read-only) and the transactional guarantees that only a database provides.

## 11.6 Audit readiness

Strong by design, unproven in fact. Append-only audit with before/after values, approval chain, IP and device is specified and surfaced; period close snapshots control totals; distributed reports are stated as archived byte-identical. But an audit trail that exists only in the browser is a demonstration of intent. Audit readiness becomes real when the persistence layer enforces immutability.

## 11.7 Scores

| Dimension | Score | Basis |
|---|---|---|
| **UX** | **89 / 100** | Context bar answers the four questions every financial figure needs; totals footers everywhere; controls explain *why* they blocked. Held back by read-only breadth — several specified surfaces exist as displays rather than workspaces. |
| **Performance** | **92 / 100** | Zero dependencies, 109 KB, single sprite. Held back by full re-render on every state change and by the absence of virtualisation, which will matter at 25.000 units. |
| **Accessibility** | **91 / 100** | Live regions on the two indicators that carry financial meaning, text alternatives for chart and ageing bar, captions and totals footers, validated forms, keyboard row activation. Held back by no live assistive-technology testing and by dense financial tables that will be hard work on a screen reader regardless of markup. |
| **Security** | **86 / 100** | Segregation of duties, step-up, dual authorisation with cooling period, typed confirmation on irreversible operations, period-lock guards moved into handlers after F8. Held back because enforcement is client-side by necessity; the server-side equivalents are specified but unbuilt. |
| **Financial compliance** | **88 / 100** | KMK-correct interest, apportionment and unit-attached debt; işletme projesi as a board-approved object; gapless numbering; fund segregation; tevkifat and stopaj; e-document status. Held back by the absence of trial balance rendering and by tax rates being displayed rather than genuinely configurable. |
| **Production readiness** | **56 / 100** | Below Sprint 01 and roughly level with Sprint 02, and correctly so. A finance module without transactional integrity, decimal database arithmetic, immutable audit persistence and bank integration is a specification with a working interface. The interface and control design are ready for implementation; the guarantees are not. |

## 11.8 Verification evidence

```
Tag balance ................ all element types balanced
Locked library ............. Sprint 01/02 component CSS included byte-identical
                             (verified by substring match, not assertion)
V22 palette ................ 18 / 18 colours present
Financial controls ......... balance indicator · segregation of duties · period lock
                             two-phase commit · integer kuruş · gapless numbering
                             three-way match · IBAN dual authorisation — all present
Domain references .......... KMK m.20/c · m.22 · m.37 · arsa payı · yenileme fonu
                             tevkifat · delil paketi · mutabakat · dönem kapanışı
Accessibility markers ...... tablist 1 · tab 11 · tabpanel 1 · status 2 · img 1
                             aria-live 4 · aria-label 20 · aria-pressed 2
                             aria-invalid 4 · aria-expanded 5 · caption 2 · tfoot 5
                             sr-only 5 · reduced-motion 1 · skip 1
Money handling ............. integer kuruş throughout; single parseFloat is input
                             parsing, immediately converted to integer
External dependencies ...... 1 (DM Sans webfont)
Browser storage ............ 0 occurrences
File size .................. 109.3 KB uncompressed
```

---

## STOP

Sprint 03 is complete. The Finance & Accounting module has been analysed, specified across eight steps, implemented, self-reviewed, corrected and validated.

**The Technical Operations module has not been started. Dashboard and AI Center were not modified.**

I am waiting for your approval before Sprint 04.
