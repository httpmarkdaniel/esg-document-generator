# ESG Document Generator

A tool with three tabs:

1. **Impact Calculator** → enter weight + material split, get carbon/water/
   energy/landfill results — reproduces the real "ESG Impact Calculator.html"
   exactly (same factors, same math). This is the single source of truth for
   ESG math anywhere in the app.
2. **Certificate** → PDF, one of 4 types, replicating `Template ESG
   Certificates.pdf` closely: the real extracted logo/tile icons/compliance
   strip, the real sampled brand colors, and the Poppins font embedded to
   match the reference's rounded typeface (jsPDF's built-in fonts don't have
   a rounded option, so this uses `doc.addFont` to embed real font files
   rather than substituting Helvetica).
3. **ESG Report** → PDF, replicating `Carbon Abatement - Client Template.pdf`
   closely: that PDF's *own* embedded images (letterhead, gradient top bar,
   two-row compliance strip, form-code footer) reused directly rather than
   redrawn, and the same serif (`times`) typeface and near-black text the
   reference uses — a deliberately different look from the certificate's
   rounded/green branding, because the two reference documents look
   different from each other.

Selecting an RR in the Certificate tab also adds that RR as a row on the
Report tab in the background (see "Receiving Report autofill" below).

"Use in Certificate" / "Add to Report" on the Calculator tab carries a
computed result straight into the Documents tab's forms — values never need
to be retyped, and the certificate/report code never re-derives ESG math
itself (see `src/calculator/calculatorEngine.js`).

## Receiving Report (RR) autofill

Both the Certificate and the Report can also pull real records from
Envirocycle's RR consolidation Google Sheet instead of manual entry:

- **Certificate**: a date-range loader narrows an RR-number picker
  (typeahead, otherwise over all ~1,725 RR reference numbers); selecting one
  autofills recipient, address, and net-weight fields from that RR's line
  items — **and adds the same RR as a row on the Report tab**, even though
  they're separate tabs.
- **Report**: a received-date range loads every RR in that window as its
  own asset-category row (weight only).

The sheet has **no material-split (metal/plastic/glass/electronics) data**
— only weight and a waste-handling category — so that part genuinely has to
be typed in (or pulled from the Calculator). Everything else is computed,
never separately entered:

- **Water Saved / Energy Saved / Landfill Averted** depend only on net
  weight (200 L/kg, 30 kWh/kg, 100% diversion) — so these fill in
  immediately from an RR's weight alone, no material breakdown needed.
- **Carbon Footprint / Recycled Emissions / Net Carbon Abated** depend on
  the per-material factors, so they compute automatically as soon as the
  Material Breakdown is filled in — there's no separate "carbon" input to
  type.

See `src/calculator/calculatorEngine.js`'s `calculateCarbonFromMaterialWeights`
/ `calculateSavingsFromNetWeight` (the only two places these formulas live)
and `api/rr-data.js` for the sheet's exact column mapping.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173 — frontend only, /api/* will 404
vercel dev             # frontend + /api/rr-data together (requires `vercel link` once)
npm run build           # production build to dist/
```

## How it works

```
Impact Calculator (weight + material split)          RR Google Sheet
      │                                                      │
      ▼                                                      ▼
calculatorEngine.calculateImpact()              api/rr-data.js (CSV → JSON)
  (source of truth for ESG math)                       │
      │                                          src/rrData/rrClient.js
      ├─ "Use in Certificate" ──────┐            (fetch, cache, aggregate)
      └─ "Add to Report" ───────┐   │                   │
                                 │   │      ┌── RR number picker (Certificate tab)
                                 ▼   ▼      └── date-range loader (Report tab)
                    Certificate tab / Report tab
                                 │
                                 ▼
                   normalize / validate data
                    │                    │
                    ▼                    ▼
      certificateData.js          reportData.js
                    │                    │
                    ▼                    ▼
   certificateTemplate.js   reportAggregator.js (→ ESGReportData)
    (Poppins font, real                  │
     cert assets)                        ▼
                    │        reportPdfTemplate.js (times font,
                    │         real report-PDF-sourced assets)
                    ▼                    ▼
  generateCertificatePdf.js       generateReportPdf.js
                    │                    │
                    ▼                    ▼
                  PDF                  PDF
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

- **`api/rr-data.js`** — Vercel serverless function. Proxies the public RR
  consolidation Google Sheet's CSV export (no service account needed — the
  sheet is shared "anyone with the link can view"), parses it with
  `papaparse`, normalizes columns to camelCase, and caches in memory for 5
  minutes. `src/rrData/rrClient.js` is the frontend client: fetch-once
  cache, plus `getRrNumbers()`, `getRrSummary(referenceNo)`, and
  `getRrSummariesInRange(startIso, endIso)`.

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
    `draw*Certificate(doc, assets, data)` function per type. `drawCertificate`
    dispatches by `data.certificateType`. This is the only file that
    knows how a certificate looks.
  - `generateCertificatePdf.js` — wires normalized data into the template
    (landscape A4) and returns a downloadable `Blob`.

- **`src/reports/`** — ESG Report PDF generation.
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
  - `reportPdfTemplate.js` — **the document design**: Client/Prepared-by/
    Reporting-period header, 1. Introduction, 2. Detailed Impact
    Breakdown (Table 1 + subtotal), 3. Recycled Materials (Table 2),
    4. Methodology, 5. Environmental Impact narrative, 6. Conclusion,
    3-signatory sign-off, compliance-logo strip. Paginates automatically
    via `jspdf-autotable` + a manual `ensureSpace` cursor.
  - `generateReportPdf.js` — wires `ESGReportData` into the template and
    returns a downloadable `Blob`.

- **`src/components/`** — the UI: `CalculatorPanel.jsx` (inputs + live
  results + breakdown table, matching the real calculator), plus
  `CertificateGenerator.jsx` and `ReportGenerator.jsx`, each with its own
  form, live preview, and generate button. `pages/ESGDocumentsPage.jsx`
  wires the Calculator's "Use in Certificate"/"Add to Report" handoffs and
  the Certificate's RR picker → Report row across tabs.

## Brand assets

Both PDFs are built from images **extracted from their own respective
reference PDF** — via PyMuPDF, merging each embedded image with its
separate PDF soft-mask/alpha channel (a naive extraction leaves opaque
black backgrounds, since the alpha channel is a distinct XObject the PDF
references via `/SMask`) — rather than redrawn from scratch:

- **`src/assets/certificate/`** (from `Template ESG Certificates.pdf`): the
  logo, tree/energy/recycle tile icons, and a compliance-logo strip
  composited from that PDF's individual badge images (its order is close
  to, but not pixel-identical to, the source's row — they were composited
  fresh rather than cropped in place). Two tile icons (CO2, water-drop)
  aren't embedded as raster images in that PDF — they're vector-drawn
  directly — so `certificateTemplate.js`'s `drawVectorIcon()` approximates
  them instead. Loaded via `src/certificate/assets.js`.
- **`src/assets/report/`** (from `Carbon Abatement - Client Template.pdf`):
  that PDF's own pre-composed images — `letterhead.png` (logo + company
  name/address/phone/email/website, all one image), `gradient-bar.png`
  (the exact teal→blue top bar), `compliance-strip.png` (its real two-row
  badge strip), `form-code.png` (the "EPI FORM-DCC ..." footer text). Using
  these directly, rather than trying to recreate them with text/shapes, is
  what makes the report match closely. Loaded via `src/reports/assets.js`.
- **`src/assets/fonts/`**: Poppins (OFL-licensed, Google Fonts) — the
  certificate's real typeface is a rounded geometric sans that jsPDF's
  built-in fonts (Helvetica/Times/Courier) can't reproduce, so
  `src/certificate/fonts.js` embeds the real TTFs into the PDF via
  `doc.addFileToVFS`/`doc.addFont` (see `fontRegistration.js` for the
  dependency-free half, split out the same way as `assetDimensions.js`, so
  Node-based tests don't need a browser to import font files). The report
  uses jsPDF's built-in `times` instead — the reference report's body text
  is a plain serif, so no embedding was needed there.

Both `assetDimensions.js` files hold just pixel dimensions in a
dependency-free module, so `certificateTemplate.js`/`reportPdfTemplate.js`
can be exercised from plain Node (no browser) when testing the drawing
logic — see the smoke-test pattern used throughout development (build a
`jsPDF` doc, pass in `fs`-read base64 assets, assert on the output bytes).

Brand colors in `src/lib/brand.js` (navy/lime/green for the certificate,
`reportBlue` for the report) were sampled pixel-for-pixel from a
`pymupdf`-rendered PNG of each reference PDF, not eyeballed.

## Replacing the templates later

When an *official* (agency-issued, not extracted) set of assets is ready:

- Swap the files in `src/assets/certificate/` or `src/assets/report/` and,
  if sizing/aspect ratios differ, adjust the corresponding
  `*_ASSET_DIMENSIONS` values.
- Certificate layout: rewrite `src/certificate/certificateTemplate.js` (the
  per-type `draw*Certificate(doc, assets, data)` functions, or just
  `drawHeader`/`drawFooter`). Nothing else needs to change.
- Report layout: rewrite `src/reports/reportPdfTemplate.js` (the
  `drawReportPdf(doc, assets, data)` function).

`certificateData.js` / `reportData.js` / `reportAggregator.js` /
`methodology.js` are the data layer and should not need to change when
the design changes.

## Stack

- Vite + React 19
- Tailwind CSS v4
- [`jspdf`](https://github.com/parallax/jsPDF) + `jspdf-autotable` for both PDFs (certificate + report)
- [Poppins](https://fonts.google.com/specimen/Poppins) (OFL) embedded into the certificate PDF; jsPDF's built-in `times` for the report
- [`papaparse`](https://www.papaparse.com/) for parsing the RR sheet's CSV export, server-side
- A Vercel serverless function (`api/rr-data.js`) proxying the public Google Sheet
