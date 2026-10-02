import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput, inputErrorClass } from './FormField.jsx'
import { emptyReportForm, emptyAssetCategoryRow, validateReportForm } from '../reports/reportData.js'
import { buildEsgReportData } from '../reports/reportAggregator.js'
import { generateReportPdf } from '../reports/generateReportPdf.js'
import { downloadBlob } from '../lib/download.js'
import { formatKg, formatNumber, formatUnit, kgString, toNumber, todayIso } from '../lib/format.js'
import { RrMultiPicker } from './RrMultiPicker.jsx'
import { ReportPreviewEditor } from './ReportPreviewEditor.jsx'
import { withoutReportDataOverrides } from '../reports/reportText.js'
import { calculateCarbonFromMaterialWeights, calculateSavingsFromNetWeight } from '../calculator/calculatorEngine.js'

/** True when an asset-category row has nothing entered yet. */
function isBlankRow(row) {
  return Object.values(row).every((v) => v === '' || v === undefined)
}

/**
 * Build an asset-category row from a calculator result or an RR sheet
 * summary. Only item/qtyKg/material-breakdown are ever stored on the row —
 * carbon/water/energy/landfill are always derived downstream (in
 * reportAggregator.js) from those, so there's nothing else to carry across
 * or keep in sync here.
 */
function rowFromCalculation({ input, result }, index) {
  return {
    item: input.description?.trim() || `Asset Category ${index}`,
    qtyKg: String(result.netWeightKg),
    metalKg: String(result.materials.metal.weightKg),
    plasticKg: String(result.materials.plastic.weightKg),
    glassKg: String(result.materials.glass.weightKg),
    electronicsKg: String(result.materials.electronics.weightKg),
  }
}

const MATERIAL_KEYS = ['metalKg', 'plasticKg', 'glassKg', 'electronicsKg']
const rowKey = (item) => String(item || '').trim().toLowerCase()

/**
 * RRs → "Item" rows: one row per real item (the RR's ITEM TYPE, e.g. LAPTOP,
 * MONITOR) with its own net weight and material-catalog split (see
 * rrClient.js's itemTypeBreakdown). The same item across several RRs is
 * summed into one row — including into an RR row already in the table.
 * Uncovered item types contribute a 0 split, never an invented one.
 * Returns the full new rows array.
 */
function mergeRrItemRows(rows, summaries) {
  const next = rows.map((r) => ({ ...r }))
  const byItem = new Map(next.filter((r) => r.rrReferenceNos).map((r) => [rowKey(r.item), r]))
  for (const summary of summaries) {
    for (const t of summary.itemTypeRows || []) {
      let row = byItem.get(rowKey(t.itemType))
      if (!row) {
        row = { item: t.itemType, qtyKg: '0', metalKg: '0', plasticKg: '0', glassKg: '0', electronicsKg: '0', unmatchedItemTypes: [], rrReferenceNos: [] }
        next.push(row)
        byItem.set(rowKey(t.itemType), row)
      }
      row.qtyKg = kgString(toNumber(row.qtyKg) + t.netWeight)
      for (const k of MATERIAL_KEYS) row[k] = kgString(toNumber(row[k]) + t.materialsKg[k])
      // Not form fields — carried alongside the row so the table can flag item
      // types the material catalog didn't cover, and so the same RR is never
      // added twice. Never sent to the PDF.
      if (!t.matched && !row.unmatchedItemTypes.includes(t.itemType)) row.unmatchedItemTypes = [...row.unmatchedItemTypes, t.itemType]
      if (!row.rrReferenceNos.includes(summary.referenceNo)) row.rrReferenceNos = [...row.rrReferenceNos, summary.referenceNo]
    }
  }
  return next
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-09-25" + "2026-09-30" → "September 25 – 30, 2026" (one date → "September 25, 2026"). */
function collectionRangeLabel(fromIso, toIso) {
  const parts = (iso) => iso.split('-').map(Number)
  const [y1, m1, d1] = parts(fromIso)
  const [y2, m2, d2] = parts(toIso)
  if (fromIso === toIso) return `${MONTHS[m1 - 1]} ${d1}, ${y1}`
  if (y1 === y2 && m1 === m2) return `${MONTHS[m1 - 1]} ${d1} – ${d2}, ${y1}`
  if (y1 === y2) return `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y1}`
  return `${MONTHS[m1 - 1]} ${d1}, ${y1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`
}

/** Split text into two lines of similar length: by comma parts if it has commas, else by words. Short text stays on one line. */
function splitInTwo(text) {
  const t = text.trim().replace(/,$/, '')
  if (t.length <= 40) return [t, '']
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean)
  const units = parts.length >= 2 ? parts : t.split(/\s+/)
  const joiner = parts.length >= 2 ? ', ' : ' '
  let best = 1
  let bestDiff = Infinity
  for (let i = 1; i < units.length; i++) {
    const diff = Math.abs(units.slice(0, i).join(joiner).length - units.slice(i).join(joiner).length)
    if (diff < bestDiff) [best, bestDiff] = [i, diff]
  }
  return [units.slice(0, best).join(joiner), units.slice(best).join(joiner)]
}

/**
 * The RR's BILLING ADDRESS split into the report's three address lines:
 * Line 1 / Line 2 (street, building, area — split evenly) and the city line.
 * The city line is the sheet's last line, else the last comma part, else a
 * trailing "… CITY [postal]" ("… FORT BONIFACIO | TAGUIG CITY").
 */
function splitAddress(address) {
  const clean = String(address || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
  if (!clean) return ['', '', '']
  const lines = clean.split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean)
  if (lines.length >= 3) return [lines[0], lines.slice(1, -1).join(', '), lines[lines.length - 1]]
  let rest
  let city
  if (lines.length === 2) [rest, city] = lines
  else {
    const parts = clean.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
      city = parts.pop()
      rest = parts.join(', ')
    } else {
      const m = clean.match(/^(.*\S)\s+((?:CITY OF\s+)?\S+\s+CITY(?:\s+\d{4})?(?:\s+\S+)?)$/i)
      ;[rest, city] = m ? [m[1], m[2]] : [clean, '']
    }
  }
  const [line1, line2] = splitInTwo(rest)
  return [line1, line2, city]
}

const AUTO_DETAIL_KEYS = ['clientName', 'clientAddressLine1', 'clientAddressLine2', 'clientCityStateZipCountry', 'collectionDateRange']

/** Row-level derived values for the read-only columns — same formulas as the Certificate/Calculator. */
function computeRowDerived(row) {
  const carbon = calculateCarbonFromMaterialWeights(row)
  const savings = calculateSavingsFromNetWeight(toNumber(row.qtyKg))
  return { ...carbon, ...savings }
}

const ROW_FIELDS = [
  ['item', 'Item', 'text'],
  ['qtyKg', 'Qty (kg)', 'number'],
  ['metalKg', 'Metal (kg)', 'number'],
  ['plasticKg', 'Plastic (kg)', 'number'],
  ['glassKg', 'Glass (kg)', 'number'],
  ['electronicsKg', 'Electronics (kg)', 'number'],
]

const COMPUTED_COLUMNS = [
  ['totalCarbonFootprintKgCO2e', 'Carbon Footprint (kgCO2e)', (d) => formatNumber(d.totalCarbonFootprintKgCO2e)],
  ['recycledEmissionsKgCO2e', 'Recycled Emissions (kgCO2e)', (d) => formatNumber(d.recycledEmissionsKgCO2e)],
  ['waterSavedLiters', 'Water Saved (L)', (d) => formatNumber(d.waterSavedLiters, 0)],
  ['energySavedKwh', 'Energy Saved (kWh)', (d) => formatNumber(d.energySavedKwh)],
  ['landfillAvertedKg', 'Landfill Averted (kg)', (d) => formatNumber(d.landfillAvertedKg)],
]

export const ReportGenerator = forwardRef(function ReportGenerator({ rowToAdd, onRowConsumed, hideActions = false }, ref) {
  const [form, setForm] = useState({
    ...emptyReportForm(),
    reportIssueDate: todayIso(),
    rows: [emptyAssetCategoryRow()],
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)
  // Edits made in the preview editor: text overrides / removed images (see
  // reports/reportText.js), and added images { id, name, dataUrl, page, x, y, w, h } in mm.
  const [textOverrides, setTextOverrides] = useState({})
  const [placedImages, setPlacedImages] = useState([])
  // Bumped to reset the RR picker (its ticks and filters) after "Clear RRs".
  const [pickerKey, setPickerKey] = useState(0)
  // The Report Details values the RRs filled in (client, address, items-collected
  // range), so new RRs / Clear RRs only replace them if they weren't typed over.
  const autoDetailsRef = useRef({})
  // Every RR currently in the report, in the order they were added.
  const [rrRefs, setRrRefs] = useState([])
  const rrRefsRef = useRef([])
  const rrSummariesRef = useRef([])

  /** Report Details from the RRs in the report: client = first RR's account, its billing address, the received-date range. */
  function autoDetailsFrom(summaries) {
    if (!summaries.length) return Object.fromEntries(AUTO_DETAIL_KEYS.map((k) => [k, '']))
    const first = summaries[0]
    const [clientAddressLine1, clientAddressLine2, clientCityStateZipCountry] = splitAddress(first.billingAddress || first.pickupAddress)
    const dates = summaries.map((s) => s.receivedDateIso).filter(Boolean).sort()
    return {
      clientName: first.accountName || first.companyName || '',
      clientAddressLine1,
      clientAddressLine2,
      clientCityStateZipCountry,
      collectionDateRange: dates.length ? collectionRangeLabel(dates[0], dates[dates.length - 1]) : '',
    }
  }

  /** Put the RR-derived details into the form, keeping anything the user typed over. */
  function applyAutoDetails(f, summaries) {
    const next = autoDetailsFrom(summaries)
    const prev = autoDetailsRef.current
    const out = { ...f }
    for (const k of AUTO_DETAIL_KEYS) {
      const untouched = !f[k] || f[k] === prev[k]
      if (untouched) out[k] = next[k]
    }
    autoDetailsRef.current = next
    return out
  }

  /**
   * Add RRs to the report: their items become "Item" rows (merged by item
   * type), and Report Details are auto-filled from them. RRs already in the
   * report are skipped. Returns { added, skipped } summaries / reference numbers.
   */
  function addRrRows(summaries) {
    const existing = new Set(rrRefsRef.current)
    const toAdd = summaries.filter((s, i) => !existing.has(s.referenceNo) && summaries.findIndex((o) => o.referenceNo === s.referenceNo) === i)
    const skipped = summaries.filter((s) => existing.has(s.referenceNo)).map((s) => s.referenceNo)
    if (toAdd.length) {
      rrRefsRef.current = [...rrRefsRef.current, ...toAdd.map((s) => s.referenceNo)]
      rrSummariesRef.current = [...rrSummariesRef.current, ...toAdd]
      setRrRefs(rrRefsRef.current)
      const allSummaries = rrSummariesRef.current
      setForm((f) => {
        const onlyRowIsBlank = f.rows.length === 1 && isBlankRow(f.rows[0])
        const rows = mergeRrItemRows(onlyRowIsBlank ? [] : f.rows, toAdd)
        return applyAutoDetails({ ...f, rows }, allSummaries)
      })
      // New figures: drop hand-edited numbers/client text in the preview editor.
      setTextOverrides(withoutReportDataOverrides)
    }
    return { added: toAdd, skipped }
  }

  const rrCount = rrRefs.length

  /** Remove every row that came from an RR (manual/calculator rows stay), and reset the RR picker. */
  function clearRrs() {
    setForm((f) => {
      const kept = f.rows.filter((r) => !r.rrReferenceNos)
      return applyAutoDetails({ ...f, rows: kept.length ? kept : [emptyAssetCategoryRow()] }, [])
    })
    rrRefsRef.current = []
    rrSummariesRef.current = []
    setRrRefs([])
    autoDetailsRef.current = {}
    setTextOverrides(withoutReportDataOverrides)
    setPickerKey((k) => k + 1)
    setStatus({ tone: 'info', message: `Cleared ${rrCount} RR(s) from the report.` })
  }

  function rrAddedMessage({ added, skipped }) {
    const skippedNote = skipped.length ? ` Skipped ${skipped.length} already in the report (${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', …' : ''}).` : ''
    if (!added.length) return { tone: 'info', message: `Nothing new to add.${skippedNote}` }
    const totalWeight = added.reduce((s, r) => s + r.totalNetWeight, 0)
    const matchedWeight = added.reduce((s, r) => s + r.materialsMatchedNetWeight, 0)
    const matchedPct = formatNumber(totalWeight > 0 ? (matchedWeight / totalWeight) * 100 : 0, 0)
    const accounts = [...new Set(rrSummariesRef.current.map((s) => s.accountName).filter(Boolean))]
    const accountNote =
      accounts.length > 1
        ? ` Heads up: these RRs belong to ${accounts.length} different accounts (${accounts.slice(0, 3).join(', ')}${accounts.length > 3 ? ', …' : ''}) — the client was set to the first one, check it.`
        : ''
    return {
      tone: accounts.length > 1 ? 'info' : 'success',
      message: `Added ${added.length} RR(s) (${formatKg(totalWeight)} net weight) — one row per item, and Report Details filled from the RR. Material Breakdown (and Carbon) auto-filled from the material split catalog for ~${matchedPct}% of the weight — check items marked "not found in catalog".${accountNote}${skippedNote}`,
    }
  }

  // Apply a calculation (from the Impact Calculator tab) or RR summaries
  // (from the Certificate's RR picker) as new asset-category rows. Either
  // way, only item/qtyKg/material-breakdown get carried across — never
  // re-derive carbon/water/energy here, that happens downstream.
  useEffect(() => {
    if (!rowToAdd) return
    if (rowToAdd.source === 'rr') {
      setStatus(rrAddedMessage(addRrRows(rowToAdd.summaries)))
    } else {
      setForm((f) => {
        const newRow = rowFromCalculation(rowToAdd, f.rows.length + 1)
        const onlyRowIsBlank = f.rows.length === 1 && isBlankRow(f.rows[0])
        return { ...f, rows: onlyRowIsBlank ? [newRow] : [...f.rows, newRow] }
      })
      setTextOverrides(withoutReportDataOverrides)
      setStatus({ tone: 'success', message: 'Calculation added as a new asset category row.' })
    }
    onRowConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowToAdd])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setRow(index, key, value) {
    setForm((f) => {
      const rows = [...f.rows]
      rows[index] = { ...rows[index], [key]: value }
      return { ...f, rows }
    })
  }

  function addRow() {
    setForm((f) => ({ ...f, rows: [...f.rows, emptyAssetCategoryRow()] }))
  }

  function removeRow(index) {
    setForm((f) => {
      const rows = f.rows.filter((_, i) => i !== index)
      // Every RR item row gone: forget the RRs too, so they can be added again.
      if (!rows.some((r) => r.rrReferenceNos)) {
        rrRefsRef.current = []
        rrSummariesRef.current = []
        setRrRefs([])
      }
      return { ...f, rows }
    })
  }


  const preview = useMemo(() => buildEsgReportData(form), [form])
  const reportData = useMemo(() => ({ ...preview, textOverrides }), [preview, textOverrides])

  /** Validate + build the PDF. Returns { ok:true, blob, filename } or { ok:false }. Never auto-downloads. */
  async function buildReport() {
    const validationErrors = validateReportForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the report.' })
      return { ok: false }
    }
    try {
      const data = { ...buildEsgReportData(form), textOverrides, placedImages }
      const { blob, filename } = await generateReportPdf(data)
      return { ok: true, blob, filename }
    } catch (err) {
      console.error(err)
      setStatus({ tone: 'error', message: 'Something went wrong generating the report PDF. Please try again.' })
      return { ok: false }
    }
  }

  useImperativeHandle(ref, () => ({ generate: buildReport }))

  async function handleGenerate() {
    setGenerating(true)
    setStatus(null)
    const result = await buildReport()
    if (result.ok) {
      downloadBlob(result.blob, result.filename)
      setStatus({ tone: 'success', message: `Report generated: ${result.filename}` })
    }
    setGenerating(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Load from Receiving Reports"
        subtitle="Tick the RRs to include in this report — their items fill the Detailed Impact Breakdown (one row per item) and the client / items-collected details fill in automatically. Narrow the list by received date or search."
      >
        <RrMultiPicker
          key={pickerKey}
          applyLabel={(n) => (n === 1 ? 'Add 1 RR to the report' : `Add ${n} RRs to the report`)}
          onApply={(summaries) => setStatus(rrAddedMessage(addRrRows(summaries)))}
          clearOnApply
        />
        {rrCount > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span>{rrCount} RR(s) in this report: {rrRefs.slice(0, 6).join(', ')}{rrRefs.length > 6 ? ', …' : ''}</span>
            <GhostButton type="button" onClick={clearRrs} className="hover:border-red-200 hover:bg-red-50 hover:text-red-700">
              Clear RRs
            </GhostButton>
          </div>
        )}
      </Card>

      <Card
        title="Detailed Impact Breakdown"
        subtitle="One row per item — matches Table 1 of the client template. Carbon/water/energy/landfill columns are computed, not typed."
      >
        {errors.rows && <p className="mb-2 text-xs text-red-600">{errors.rows}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr>
                {ROW_FIELDS.map(([key, label]) => (
                  <th key={key} className="px-1 pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {label}
                  </th>
                ))}
                {COMPUTED_COLUMNS.map(([key, label]) => (
                  <th key={key} className="px-1 pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {form.rows.map((row, i) => {
                const derived = computeRowDerived(row)
                return (
                  <tr key={i}>
                    {ROW_FIELDS.map(([key, , type]) => (
                      <td key={key} className="px-1">
                        <TextInput
                          type={type}
                          inputMode={type === 'number' ? 'decimal' : undefined}
                          value={row[key]}
                          onChange={(e) => setRow(i, key, e.target.value)}
                          className="min-w-[90px]"
                        />
                        {key === 'item' && row.unmatchedItemTypes?.length > 0 && (
                          <p className="mt-1 max-w-[220px] text-[11px] font-medium text-amber-700">
                            Not found in catalog, please input manually — {row.unmatchedItemTypes.slice(0, 3).join(', ')}
                            {row.unmatchedItemTypes.length > 3 ? ', …' : ''}
                          </p>
                        )}
                      </td>
                    ))}
                    {COMPUTED_COLUMNS.map(([key, , format]) => (
                      <td key={key} className="px-1">
                        <div className="flex h-[38px] min-w-[90px] items-center rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-600">
                          {format(derived)}
                        </div>
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="rounded-lg px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-600"
                        aria-label="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <GhostButton type="button" onClick={addRow} className="mt-2">
          + Add item
        </GhostButton>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Report Details" subtitle='Matches the "Carbon Abatement Report" client template.'>
          <div className="grid gap-4">
            <FormField label="Report Title">
              <TextInput value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Client / Company Name" error={errors.clientName}>
                <TextInput
                  value={form.clientName}
                  onChange={(e) => setField('clientName', e.target.value)}
                  placeholder="Acme Corporation"
                  className={inputErrorClass(errors.clientName)}
                />
              </FormField>
              <FormField label="Client Address Line 1" hint="Optional">
                <TextInput value={form.clientAddressLine1} onChange={(e) => setField('clientAddressLine1', e.target.value)} />
              </FormField>
              <FormField label="Client Address Line 2" hint="Optional">
                <TextInput value={form.clientAddressLine2} onChange={(e) => setField('clientAddressLine2', e.target.value)} />
              </FormField>
              <FormField label="City, Province/State, Postal Code, Country" hint="Optional">
                <TextInput value={form.clientCityStateZipCountry} onChange={(e) => setField('clientCityStateZipCountry', e.target.value)} />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Items Collected (date or range)" hint='e.g. "January 2025 - December 2025"'>
                <TextInput value={form.collectionDateRange} onChange={(e) => setField('collectionDateRange', e.target.value)} />
              </FormField>
              <FormField label="Report Issue Date" error={errors.reportIssueDate}>
                <TextInput
                  type="date"
                  value={form.reportIssueDate}
                  onChange={(e) => setField('reportIssueDate', e.target.value)}
                  className={inputErrorClass(errors.reportIssueDate)}
                />
              </FormField>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Report Summary">
            <div className="mb-4 space-y-1 text-sm">
              <Row label="Client" value={form.clientName} />
              <Row label="Report Issued" value={preview.reportIssueDateLabel} />
              <Row label="Asset Categories" value={formatNumber(preview.rows.length, 0)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Materials Processed', formatKg(preview.totals.materialsTotalKg)],
                ['Net Carbon Abated', formatUnit(preview.totals.netCarbonAbatedKgCO2e, 'kg CO2e')],
                ['Water Saved', formatUnit(preview.totals.waterSavedLiters, 'L', 0)],
                ['Energy Saved', formatUnit(preview.totals.energySavedKwh, 'kWh')],
                ['Landfill Averted', formatKg(preview.totals.landfillAvertedKg)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-brand-green/15 bg-brand-green-light px-3 py-2.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-brand-green/70">{label}</div>
                  <div className="mt-0.5 text-lg font-semibold text-brand-green-dark">{value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Recycled Materials Summary">
            <div className="space-y-1.5 text-sm">
              {preview.recycledMaterials.map((m) => (
                <div key={m.material} className="flex items-baseline justify-between gap-3 border-b border-gray-50 py-1 last:border-0">
                  <span className="text-gray-600">{m.material}</span>
                  <span className="font-medium text-gray-800">{formatKg(m.quantityKg)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Status + Generate sit right above the report preview, so they're seen before generating. */}
      <ReportPreviewEditor
        data={reportData}
        overrides={textOverrides}
        onOverridesChange={setTextOverrides}
        images={placedImages}
        onImagesChange={setPlacedImages}
        actions={
          (status || !hideActions) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">{status && <Banner tone={status.tone}>{status.message}</Banner>}</div>
              {!hideActions && (
                <PrimaryButton type="button" onClick={handleGenerate} loading={generating} className="shrink-0 sm:w-64">
                  {generating ? 'Generating…' : 'Generate PDF Report'}
                </PrimaryButton>
              )}
            </div>
          )
        }
      />
    </div>
  )
})

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-50 py-1 last:border-0">
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="truncate text-right font-medium text-gray-800">{value || '—'}</span>
    </div>
  )
}
