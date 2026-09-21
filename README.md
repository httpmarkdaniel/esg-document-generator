# ESG Document Generator

A tool with three tabs:

0. **Impact Calculator** → enter weight + material split, get carbon/water/
   energy/landfill results — reproduces the real "ESG Impact Calculator.html"
   exactly (same factors, same math). This is the source of truth for every
   number in the other two tabs.
1. **Certificates** → PDF, one of 4 types, each matching a real EnviroCycle template:
   - Environmental Impact Certificate (`EIC-YYYY-####`)
   - Carbon Abatement Certificate (`CAC-YYYY-####`)
   - Landfill Diverted Certificate (`LDC-YYYY-####`)
   - Recycled Plastics Certificate (`RPC-YYYY-####`)
2. **Carbon Abatement Report** → Word `.docx`, aggregated from asset-category
   line items over a reporting period, matching the real
   "Carbon Abatement - Client Template.pdf".

"Use in Certificate" / "Add to Report" on the Calculator tab carries a
computed result straight into the other tabs' forms — values never need to
be retyped, and the certificate/report code never re-derives ESG math itself
(see `src/calculator/calculatorEngine.js`). Manual entry still works too, for
values that didn't come from the calculator (e.g. Recycled Plastics figures,
which the calculator doesn't cover).

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## How it works

```
Impact Calculator (weight + material split)
      │
      ▼
calculatorEngine.calculateImpact()  ← single source of truth for ESG math
      │
      ├─ "Use in Certificate" ──► prefills Certificate form
      │
      └─ "Add to Report" ──► appends a Report asset-category row

Form input (React, calculator-derived or typed by hand)
      │
      ▼
normalize / validate data
      │
      ├── Certificate ──► certificateData.js ──► certificateTemplate.js ──► generateCertificatePdf.js ──► PDF
      │                         (picks one of 4 type-specific drawers, by data.certificateType)
      │
      └── Report ──► reportData.js ──► reportAggregator.js (→ ESGReportData) ──► reportTemplate.js ──► generateReportDocx.js ──► DOCX
```

- **`src/calculator/`** — the ESG math, reverse-engineered from the real
  calculator's rendered breakdown table (its JS bundle wasn't included in
  the saved HTML, but the factors and formulas are fully spelled out on the
  page itself — verified to reproduce its example output exactly).
  - `calculatorEngine.js` — pure `calculateImpact({ grossKg, tareKg, split })`
    function + the factor constants (primary emission factors per material,
    the 20%-of-primary recycling-factor rule, 200 L/kg water, 30 kWh/kg
    energy, 100% landfill diversion). **This is the only file that should
    ever contain ESG formulas** — certificate/report code must consume its
    output, never recompute.
  - `calculatorForm.js` — form defaults + validation (net weight > 0,
    material split sums to 100%).

- **`src/lib/brand.js`** — shared brand constants: company info, colors,
  the 3 fixed signatories, the 4 certificate types (prefix/title/
  disclaimer), material benefit text, and equivalency assumptions (km per
  kg CO2e, liters per Olympic pool, etc.). Both `certificate/` and
  `reports/` read from here so the branding/assumptions stay in one place.

- **`src/certificate/`** — PDF certificate generation (all 4 types).
  - `certificateData.js` — form defaults, per-type validation, and
    normalization. Net Carbon Abated, km-avoided, and Plastic Waste are
    always **derived** here (footprint − emissions, etc.), never typed by
    the user, so every certificate stays internally consistent. Numbers
    are coerced, blanks fall back to `—`, never `NaN`/`undefined`/`null`.
  - `certificateTemplate.js` — **the visual design**: shared navy/lime
    header, recipient block, signature row, and footer, plus one
    `draw*Certificate(doc, data)` function per type. `drawCertificate`
    dispatches by `data.certificateType`. This is the only file that
    knows how a certificate looks.
  - `generateCertificatePdf.js` — wires normalized data into the template
    (landscape A4) and returns a downloadable `Blob`.

- **`src/reports/`** — Word report generation.
  - `methodology.js` — the company's **real, fixed** methodology and
    boilerplate text (Introduction, 4.1–4.4 Methodology, Conclusion),
    reproduced from the reference template — not user-editable free text.
  - `reportData.js` — form defaults (client info + asset-category rows)
    and validation.
  - `reportAggregator.js` — sums the asset-category rows into column
    totals, derives the Recycled Materials table and all equivalencies
    (km avoided, Olympic pools, household-years, car-weights) into an
    `ESGReportData` object (the internal data model — not itself a
    deliverable, just what feeds the template).
  - `reportTemplate.js` — **the document design**: Client/Prepared-by/
    Reporting-period header, 1. Introduction, 2. Detailed Impact
    Breakdown (Table 1 + subtotal), 3. Recycled Materials (Table 2),
    4. Methodology, 5. Environmental Impact narrative, 6. Conclusion,
    3-signatory sign-off block.
  - `generateReportDocx.js` — wires `ESGReportData` into the template and
    returns a downloadable `Blob` via the `docx` library's `Packer`.

- **`src/components/`** — the UI: `CalculatorPanel.jsx` (inputs + live
  results + breakdown table, matching the real calculator), plus
  `CertificateGenerator.jsx` (type selector + dynamic fields per type +
  live preview) and `ReportGenerator.jsx` (client fields + editable
  asset-category table + live totals) — both accept a prefill/row prop
  that `pages/ESGDocumentsPage.jsx` sets when the Calculator hands off a
  result. (Impact Calculator / Certificate / ESG Report tabs.)

## Replacing the templates later

The layouts are close to the real reference PDFs but use **vector-drawn
placeholders** for the logo mark and the ISO/BSI/FDA/UN compliance-logo
strip (no image assets were available to embed). When the official assets
are ready:

- Certificate: rewrite `src/certificate/certificateTemplate.js` (the
  per-type `draw*Certificate(doc, data)` functions, or just
  `drawHeader`/`drawFooter` for the logo/compliance strip). Nothing else
  needs to change.
- Report: rewrite `src/reports/reportTemplate.js` (the
  `buildReportDocument(data)` function) — or, if an official
  `esg-report-template.docx` is supplied, swap `generateReportDocx.js` to
  fill that template instead of building a `Document` from scratch.

`certificateData.js` / `reportData.js` / `reportAggregator.js` /
`methodology.js` are the data layer and should not need to change when
the design changes.

## Stack

- Vite + React 19
- Tailwind CSS v4
- [`jspdf`](https://github.com/parallax/jsPDF) + `jspdf-autotable` for the PDF certificates
- [`docx`](https://docx.js.org/) for the Word report
