import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput, inputErrorClass } from './FormField.jsx'
import { emptyReportForm, emptyAssetCategoryRow, validateReportForm } from '../reports/reportData.js'
import { buildEsgReportData } from '../reports/reportAggregator.js'
import { generateReportPdf } from '../reports/generateReportPdf.js'
import { downloadBlob } from '../lib/download.js'
import { formatKg, formatNumber, formatUnit, todayIso } from '../lib/format.js'
import { getRrSummariesInRange } from '../rrData/rrClient.js'

/** True when an asset-category row has nothing entered yet. */
function isBlankRow(row) {
  return Object.values(row).every((v) => v === '' || v === undefined)
}

/** Build an asset-category row directly from a calculator result — never re-derive the numbers. */
function rowFromCalculation({ input, result }, index) {
  return {
    item: input.description?.trim() || `Asset Category ${index}`,
    qtyKg: String(result.netWeightKg),
    metalKg: String(result.materials.metal.weightKg),
    plasticKg: String(result.materials.plastic.weightKg),
    glassKg: String(result.materials.glass.weightKg),
    electronicsKg: String(result.materials.electronics.weightKg),
    carbonFootprintKgCO2e: String(result.totalCarbonFootprintKgCO2e),
    recycledEmissionsKgCO2e: String(result.recycledEmissionsKgCO2e),
    waterSavedLiters: String(result.waterSavedLiters),
    energySavedKwh: String(result.energySavedKwh),
    landfillAvertedKg: String(result.landfillAvertedKg),
  }
}

/**
 * Build an asset-category row directly from an RR sheet summary. The sheet
 * has no material-split/carbon/water/energy data, so only weight-based
 * fields are filled — carbon/water/energy are left blank for manual entry
 * (or via the Calculator), never invented.
 */
function rowFromRrSummary(summary) {
  return {
    item: `RR ${summary.referenceNo} — ${summary.accountName}`,
    qtyKg: String(summary.totalNetWeight),
    metalKg: '',
    plasticKg: '',
    glassKg: '',
    electronicsKg: '',
    carbonFootprintKgCO2e: '',
    recycledEmissionsKgCO2e: '',
    waterSavedLiters: '',
    energySavedKwh: '',
    landfillAvertedKg: String(summary.totalNetWeight),
  }
}

const ROW_FIELDS = [
  ['item', 'Asset Category', 'text'],
  ['qtyKg', 'Qty (kg)', 'number'],
  ['metalKg', 'Metal (kg)', 'number'],
  ['plasticKg', 'Plastic (kg)', 'number'],
  ['glassKg', 'Glass (kg)', 'number'],
  ['electronicsKg', 'Electronics (kg)', 'number'],
  ['carbonFootprintKgCO2e', 'Carbon Footprint (kgCO2e)', 'number'],
  ['recycledEmissionsKgCO2e', 'Recycled Emissions (kgCO2e)', 'number'],
  ['waterSavedLiters', 'Water Saved (L)', 'number'],
  ['energySavedKwh', 'Energy Saved (kWh)', 'number'],
  ['landfillAvertedKg', 'Landfill Averted (kg)', 'number'],
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

  const [rrRangeStart, setRrRangeStart] = useState('')
  const [rrRangeEnd, setRrRangeEnd] = useState('')
  const [rrLoading, setRrLoading] = useState(false)
  const [rrError, setRrError] = useState(null)

  // Apply a calculation handed over from the Impact Calculator tab as a new
  // asset-category row. The calculator is the source of truth for these
  // numbers — never re-derive them here, just carry them across.
  useEffect(() => {
    if (!rowToAdd) return
    setForm((f) => {
      const newRow = rowFromCalculation(rowToAdd, f.rows.length + 1)
      const onlyRowIsBlank = f.rows.length === 1 && isBlankRow(f.rows[0])
      return { ...f, rows: onlyRowIsBlank ? [newRow] : [...f.rows, newRow] }
    })
    setStatus({ tone: 'success', message: 'Calculation added as a new asset category row.' })
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
    setForm((f) => ({ ...f, rows: f.rows.filter((_, i) => i !== index) }))
  }

  async function handleLoadRrRange() {
    if (!rrRangeStart || !rrRangeEnd) {
      setRrError('Pick both a start and end date.')
      return
    }
    setRrLoading(true)
    setRrError(null)
    try {
      const summaries = await getRrSummariesInRange(rrRangeStart, rrRangeEnd)
      if (!summaries.length) {
        setRrError('No RRs found received in that date range.')
        return
      }
      const newRows = summaries.map(rowFromRrSummary)
      setForm((f) => {
        const onlyRowIsBlank = f.rows.length === 1 && isBlankRow(f.rows[0])
        return {
          ...f,
          collectionDateRange: f.collectionDateRange || `${rrRangeStart} to ${rrRangeEnd}`,
          rows: onlyRowIsBlank ? newRows : [...f.rows, ...newRows],
        }
      })
      setStatus({
        tone: 'success',
        message: `Loaded ${summaries.length} RR(s) received ${rrRangeStart} to ${rrRangeEnd}. Carbon/water/energy weren't in the sheet — fill those in manually or via the Calculator.`,
      })
    } catch (err) {
      setRrError(err.message)
    } finally {
      setRrLoading(false)
    }
  }

  const preview = useMemo(() => buildEsgReportData(form), [form])

  /** Validate + build the PDF. Returns { ok:true, blob, filename } or { ok:false }. Never auto-downloads. */
  async function buildReport() {
    const validationErrors = validateReportForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the report.' })
      return { ok: false }
    }
    try {
      const data = buildEsgReportData(form)
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
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
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

        <Card title="Load from Receiving Reports" subtitle="Pull every RR received in a date range straight from the Google Sheet.">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Received From">
              <TextInput type="date" value={rrRangeStart} onChange={(e) => setRrRangeStart(e.target.value)} />
            </FormField>
            <FormField label="Received To">
              <TextInput type="date" value={rrRangeEnd} onChange={(e) => setRrRangeEnd(e.target.value)} />
            </FormField>
            <div className="flex items-end">
              <PrimaryButton type="button" onClick={handleLoadRrRange} loading={rrLoading} className="w-full">
                {rrLoading ? 'Loading…' : 'Load RRs in range'}
              </PrimaryButton>
            </div>
          </div>
          {rrError && (
            <div className="mt-2">
              <Banner tone="error">{rrError}</Banner>
            </div>
          )}
        </Card>

        <Card title="Detailed Impact Breakdown" subtitle="One row per asset category — matches Table 1 of the client template.">
          {errors.rows && <p className="mb-2 text-xs text-red-600">{errors.rows}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-1.5 text-sm">
              <thead>
                <tr>
                  {ROW_FIELDS.map(([key, label]) => (
                    <th key={key} className="px-1 pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {label}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.rows.map((row, i) => (
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
                ))}
              </tbody>
            </table>
          </div>
          <GhostButton type="button" onClick={addRow} className="mt-2">
            + Add asset category
          </GhostButton>
        </Card>
      </div>

      <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <Card title="Report Preview">
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
              <div key={label} className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">{label}</div>
                <div className="mt-0.5 text-lg font-semibold text-emerald-900">{value}</div>
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

        {!hideActions && (
          <Card>
            <div className="flex flex-col gap-3">
              {status && <Banner tone={status.tone}>{status.message}</Banner>}
              <PrimaryButton type="button" onClick={handleGenerate} loading={generating}>
                {generating ? 'Generating…' : 'Generate PDF Report'}
              </PrimaryButton>
            </div>
          </Card>
        )}
        {hideActions && status && (
          <Card>
            <Banner tone={status.tone}>{status.message}</Banner>
          </Card>
        )}
      </div>
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
