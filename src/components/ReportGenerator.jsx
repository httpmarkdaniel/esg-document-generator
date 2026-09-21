import { useMemo, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput, TextArea, inputErrorClass } from './FormField.jsx'
import { ImpactPreviewGrid } from './ImpactPreviewGrid.jsx'
import { emptyReportForm, emptyTransactionRow, emptyMaterialRow, validateReportForm } from '../reports/reportData.js'
import { buildEsgReportData } from '../reports/reportAggregator.js'
import { generateReportDocx } from '../reports/generateReportDocx.js'
import { downloadBlob } from '../lib/download.js'
import { formatNumber, todayIso } from '../lib/format.js'

const TXN_FIELDS = [
  ['date', 'Date', 'date'],
  ['reference', 'Reference', 'text'],
  ['description', 'Item / Description', 'text'],
  ['quantity', 'Qty', 'number'],
  ['netWeightKg', 'Net Wt (kg)', 'number'],
  ['carbonAbatedKgCO2e', 'Carbon (kgCO2e)', 'number'],
  ['waterSavedLiters', 'Water (L)', 'number'],
  ['energySavedKwh', 'Energy (kWh)', 'number'],
]

export function ReportGenerator() {
  const [form, setForm] = useState({
    ...emptyReportForm(),
    periodStart: todayIso(),
    periodEnd: todayIso(),
    transactions: [emptyTransactionRow()],
  })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFilter(key, value) {
    setForm((f) => ({ ...f, filters: { ...f.filters, [key]: value } }))
  }

  function setTransaction(index, key, value) {
    setForm((f) => {
      const transactions = [...f.transactions]
      transactions[index] = { ...transactions[index], [key]: value }
      return { ...f, transactions }
    })
  }

  function addTransaction() {
    setForm((f) => ({ ...f, transactions: [...f.transactions, emptyTransactionRow()] }))
  }

  function removeTransaction(index) {
    setForm((f) => ({ ...f, transactions: f.transactions.filter((_, i) => i !== index) }))
  }

  function setMaterial(index, key, value) {
    setForm((f) => {
      const materials = [...f.materials]
      materials[index] = { ...materials[index], [key]: value }
      return { ...f, materials }
    })
  }

  function addMaterial() {
    setForm((f) => ({ ...f, materials: [...f.materials, emptyMaterialRow()] }))
  }

  function removeMaterial(index) {
    setForm((f) => ({ ...f, materials: f.materials.filter((_, i) => i !== index) }))
  }

  const preview = useMemo(() => buildEsgReportData(form), [form])

  async function handleGenerate() {
    const validationErrors = validateReportForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the report.' })
      return
    }

    setGenerating(true)
    setStatus(null)
    try {
      const data = buildEsgReportData(form)
      const { blob, filename } = await generateReportDocx(data)
      downloadBlob(blob, filename)
      setStatus({ tone: 'success', message: `Report generated: ${filename}` })
    } catch (err) {
      console.error(err)
      setStatus({ tone: 'error', message: 'Something went wrong generating the Word report. Please try again.' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Card title="Report Details" subtitle="A report aggregates multiple calculations / transactions.">
          <div className="grid gap-4">
            <FormField label="Report Title">
              <TextInput value={form.title} onChange={(e) => setField('title', e.target.value)} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Reporting Period — From" error={errors.periodStart}>
                <TextInput
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setField('periodStart', e.target.value)}
                  className={inputErrorClass(errors.periodStart)}
                />
              </FormField>
              <FormField label="Reporting Period — To" error={errors.periodEnd}>
                <TextInput
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setField('periodEnd', e.target.value)}
                  className={inputErrorClass(errors.periodEnd)}
                />
              </FormField>
            </div>

            <FormField label="Organization / Client" hint="Optional">
              <TextInput value={form.organization} onChange={(e) => setField('organization', e.target.value)} />
            </FormField>

            <div className="border-t border-gray-100 pt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Optional Filters</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {['client', 'vendor', 'project', 'auction', 'branch'].map((key) => (
                  <FormField key={key} label={key}>
                    <TextInput value={form.filters[key]} onChange={(e) => setFilter(key, e.target.value)} />
                  </FormField>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Transactions" subtitle="Each row feeds the aggregated totals and the report's transaction table.">
          {errors.transactions && <p className="mb-2 text-xs text-red-600">{errors.transactions}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-sm">
              <thead>
                <tr>
                  {TXN_FIELDS.map(([key, label]) => (
                    <th key={key} className="px-1 pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      {label}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {form.transactions.map((t, i) => (
                  <tr key={i}>
                    {TXN_FIELDS.map(([key, , type]) => (
                      <td key={key} className="px-1">
                        <TextInput
                          type={type}
                          inputMode={type === 'number' ? 'decimal' : undefined}
                          value={t[key]}
                          onChange={(e) => setTransaction(i, key, e.target.value)}
                          className="min-w-[90px]"
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        onClick={() => removeTransaction(i)}
                        className="rounded-lg px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-600"
                        aria-label="Remove transaction"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <GhostButton type="button" onClick={addTransaction} className="mt-2">
            + Add transaction
          </GhostButton>
        </Card>

        <Card title="Material Breakdown" subtitle="Optional — used for the report's material breakdown table.">
          <div className="grid gap-2">
            {form.materials.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextInput
                  value={m.material}
                  onChange={(e) => setMaterial(i, 'material', e.target.value)}
                  placeholder="Material (e.g. Plastic)"
                  className="flex-1"
                />
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={m.weightKg}
                  onChange={(e) => setMaterial(i, 'weightKg', e.target.value)}
                  placeholder="Weight (kg)"
                  className="w-32"
                />
                <button
                  type="button"
                  onClick={() => removeMaterial(i)}
                  className="rounded-lg px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-red-600"
                  aria-label="Remove material"
                >
                  ✕
                </button>
              </div>
            ))}
            {form.materials.length === 0 && <p className="text-xs text-gray-400">No materials added.</p>}
          </div>
          <GhostButton type="button" onClick={addMaterial} className="mt-2">
            + Add material
          </GhostButton>
        </Card>

        <Card title="Carbon Breakdown & Methodology" subtitle="Optional — improves the Carbon Impact and Methodology sections.">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Primary Material Emissions (kg CO2e)" hint="Optional">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.primaryMaterialEmissionsKgCO2e}
                  onChange={(e) => setField('primaryMaterialEmissionsKgCO2e', e.target.value)}
                />
              </FormField>
              <FormField label="Recycling Emissions (kg CO2e)" hint="Optional">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.recyclingEmissionsKgCO2e}
                  onChange={(e) => setField('recyclingEmissionsKgCO2e', e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Methodology Version" hint="Optional">
                <TextInput value={form.methodologyVersion} onChange={(e) => setField('methodologyVersion', e.target.value)} />
              </FormField>
              <FormField label="Methodology Source" hint="Optional">
                <TextInput value={form.methodologySource} onChange={(e) => setField('methodologySource', e.target.value)} />
              </FormField>
            </div>
            <FormField label="Assumptions" hint="Optional — one per line">
              <TextArea rows={3} value={form.assumptions} onChange={(e) => setField('assumptions', e.target.value)} />
            </FormField>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
        <Card title="Report Preview">
          <div className="mb-4 space-y-1 text-sm">
            <Row label="Period" value={`${form.periodStart || '—'} to ${form.periodEnd || '—'}`} />
            <Row label="Transactions" value={formatNumber(preview.summary.transactionCount, 0)} />
          </div>
          <ImpactPreviewGrid
            netWeightKg={preview.summary.totalNetWeightKg}
            carbonAbatedKgCO2e={preview.summary.carbonAbatedKgCO2e}
            waterSavedLiters={preview.summary.waterSavedLiters}
            energySavedKwh={preview.summary.energySavedKwh}
            landfillAvertedKg={preview.summary.landfillAvertedKg}
          />
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            {status && <Banner tone={status.tone}>{status.message}</Banner>}
            <PrimaryButton type="button" onClick={handleGenerate} loading={generating}>
              {generating ? 'Generating…' : 'Generate Word Report'}
            </PrimaryButton>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-50 py-1 last:border-0">
      <span className="text-xs uppercase tracking-wide text-gray-400">{label}</span>
      <span className="truncate text-right font-medium text-gray-800">{value || '—'}</span>
    </div>
  )
}
