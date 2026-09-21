# ESG Document Generator

A standalone tool for generating EnviroCycle ESG documents directly from
manually entered values — no calculator, database, or other app required:

1. **Certificates** → PDF, one of 4 types, each matching a real EnviroCycle template:
   - Environmental Impact Certificate (`EIC-YYYY-####`)
   - Carbon Abatement Certificate (`CAC-YYYY-####`)
   - Landfill Diverted Certificate (`LDC-YYYY-####`)
   - Recycled Plastics Certificate (`RPC-YYYY-####`)
2. **Carbon Abatement Report** → Word `.docx`, aggregated from asset-category
   line items over a reporting period, matching the real
   "Carbon Abatement - Client Template.pdf".

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## How it works

```
Form input (React)
      │
      ▼
normalize / validate data
      │
      ├── Certificate ──► certificateData.js ──► certificateTemplate.js ──► generateCertificatePdf.js ──► PDF
      │                         (picks one of 4 type-specific drawers, by data.certificateType)
      │
      └── Report ──► reportData.js ──► reportAggregator.js (→ ESGReportData) ──► reportTemplate.js ──► generateReportDocx.js ──► DOCX
```

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

- **`src/components/`** — the UI: `CertificateGenerator.jsx` (type
  selector + dynamic fields per type + live preview) and
  `ReportGenerator.jsx` (client fields + editable asset-category table +
  live totals), under `pages/ESGDocumentsPage.jsx` (Certificate / ESG
  Report tabs).

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
