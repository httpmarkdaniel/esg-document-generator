# ESG Document Generator

A standalone tool for generating two ESG documents directly from manually
entered values — no calculator, database, or other app required:

1. **Environmental Impact Certificate** → PDF (one transaction/calculation)
2. **Environmental Impact Report** → Word `.docx` (many transactions, aggregated over a period)

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
      │
      └── Report ──► reportData.js ──► reportAggregator.js (→ ESGReportData) ──► reportTemplate.js ──► generateReportDocx.js ──► DOCX
```

- **`src/certificate/`** — PDF certificate generation.
  - `certificateData.js` — form defaults, validation, normalization (numbers
    coerced, blanks fall back to `—`, never `NaN`/`undefined`/`null`).
  - `certificateTemplate.js` — **the visual design**. This is the only file
    that knows how the certificate looks.
  - `generateCertificatePdf.js` — wires normalized data into the template
    and returns a downloadable `Blob`.

- **`src/reports/`** — Word report generation.
  - `reportData.js` — form defaults + validation.
  - `reportAggregator.js` — sums manually entered transactions/materials
    into an `ESGReportData` object (the internal data model — not itself a
    deliverable, just what feeds the template).
  - `reportTemplate.js` — **the document design** (cover, executive
    summary, impact summary, material breakdown, carbon impact,
    transaction details, methodology, generated-document info).
  - `generateReportDocx.js` — wires `ESGReportData` into the template and
    returns a downloadable `Blob` via the `docx` library's `Packer`.

- **`src/components/`** — the UI: `CertificateGenerator.jsx` and
  `ReportGenerator.jsx`, each with a form + live preview + generate button,
  under `pages/ESGDocumentsPage.jsx` (Certificate / ESG Report tabs).

## Replacing the templates later

The current certificate and report layouts are **temporary**. When the
official designs are ready:

- Certificate: rewrite `src/certificate/certificateTemplate.js` (the
  `drawCertificate(doc, data)` function). Nothing else needs to change.
- Report: rewrite `src/reports/reportTemplate.js` (the
  `buildReportDocument(data)` function) — or, if an official
  `esg-report-template.docx` is supplied, swap `generateReportDocx.js` to
  fill that template instead of building a `Document` from scratch.

`certificateData.js` / `reportData.js` / `reportAggregator.js` are the data
layer and should not need to change when the design changes.

## Stack

- Vite + React 19
- Tailwind CSS v4
- [`jspdf`](https://github.com/parallax/jsPDF) + `jspdf-autotable` for the PDF certificate
- [`docx`](https://docx.js.org/) for the Word report
