import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Card, PrimaryButton, Banner } from './Card.jsx'
import { FormField, TextInput, inputErrorClass } from './FormField.jsx'
import {
  emptyCertificateForm,
  validateCertificateForm,
  normalizeCertificateData,
  generateCertificateNumber,
} from '../certificate/certificateData.js'
import { generateCertificatePdf } from '../certificate/generateCertificatePdf.js'
import { CERTIFICATE_TYPE_LIST } from '../lib/brand.js'
import { downloadBlob } from '../lib/download.js'
import { formatKg, formatNumber, formatUnit, todayIso } from '../lib/format.js'
import { getRrNumbers, getRrSummary, getRrSummariesInRange } from '../rrData/rrClient.js'

export const CertificateGenerator = forwardRef(function CertificateGenerator(
  { prefillCalculation, onPrefillConsumed, onRrSelected, hideActions = false },
  ref,
) {
  const [form, setForm] = useState({ ...emptyCertificateForm(), periodStart: todayIso(), periodEnd: todayIso(), givenDate: todayIso() })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)

  const [rrNumbers, setRrNumbers] = useState([])
  const [rrInput, setRrInput] = useState('')
  const [rrLoading, setRrLoading] = useState(false)
  const [rrSummary, setRrSummary] = useState(null)
  const [rrError, setRrError] = useState(null)

  const [rrRangeStart, setRrRangeStart] = useState('')
  const [rrRangeEnd, setRrRangeEnd] = useState('')
  const [rrRangeLoading, setRrRangeLoading] = useState(false)
  const [rrRangeError, setRrRangeError] = useState(null)
  const [rrFilteredNumbers, setRrFilteredNumbers] = useState(null) // null = no filter (show all)

  useEffect(() => {
    getRrNumbers()
      .then(setRrNumbers)
      .catch((err) => setRrError(err.message))
  }, [])

  async function handleLoadRrRange() {
    if (!rrRangeStart || !rrRangeEnd) {
      setRrRangeError('Pick both a start and end date.')
      return
    }
    setRrRangeLoading(true)
    setRrRangeError(null)
    try {
      const summaries = await getRrSummariesInRange(rrRangeStart, rrRangeEnd)
      setRrFilteredNumbers(summaries.map((s) => s.referenceNo))
      if (!summaries.length) setRrRangeError('No RRs found received in that date range.')
    } catch (err) {
      setRrRangeError(err.message)
    } finally {
      setRrRangeLoading(false)
    }
  }

  const rrOptionList = rrFilteredNumbers ?? rrNumbers

  // Apply a calculation handed over from the Impact Calculator tab. The
  // calculator is the source of truth for these numbers — we only carry
  // across net weight + material breakdown; carbon/water/energy are then
  // re-derived downstream by normalizeCertificateData using the exact same
  // formulas, so there's never a second copy of these numbers to keep in
  // sync.
  useEffect(() => {
    if (!prefillCalculation) return
    const { result } = prefillCalculation
    setForm((f) => ({
      ...f,
      materialsCollectedKg: String(result.netWeightKg),
      landfillDivertedKg: String(result.landfillAvertedKg),
      materials: {
        metalKg: String(result.materials.metal.weightKg),
        plasticKg: String(result.materials.plastic.weightKg),
        glassKg: String(result.materials.glass.weightKg),
        electronicsKg: String(result.materials.electronics.weightKg),
      },
    }))
    setStatus({ tone: 'success', message: 'Calculation applied from the Impact Calculator.' })
    onPrefillConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCalculation])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setMaterial(key, value) {
    setForm((f) => ({ ...f, materials: { ...f.materials, [key]: value } }))
  }

  function setType(certificateType) {
    setForm((f) => ({ ...f, certificateType }))
    setErrors({})
    setStatus(null)
  }

  async function handleRrSelect(referenceNo) {
    setRrInput(referenceNo)
    if (!rrOptionList.includes(referenceNo)) {
      setRrSummary(null)
      return
    }
    setRrLoading(true)
    setRrError(null)
    try {
      const summary = await getRrSummary(referenceNo)
      setRrSummary(summary)
      setForm((f) => ({
        ...f,
        recipient: summary.accountName || f.recipient,
        companyAddress: summary.pickupAddress || summary.billingAddress || f.companyAddress,
        materialsCollectedKg: String(summary.totalNetWeight),
        landfillDivertedKg: String(summary.totalNetWeight),
        materials: {
          metalKg: String(summary.materialsKg.metalKg),
          plasticKg: String(summary.materialsKg.plasticKg),
          glassKg: String(summary.materialsKg.glassKg),
          electronicsKg: String(summary.materialsKg.electronicsKg),
        },
      }))
      const matchedPct = formatNumber(summary.materialsMatchedFraction * 100, 0)
      const coverageNote =
        summary.materialsMatchedFraction >= 0.999
          ? 'Material Breakdown auto-filled from the material split catalog — Carbon now computes automatically too.'
          : `Material Breakdown auto-filled from the material split catalog for ${matchedPct}% of the weight (by item type) — the rest (${summary.unmatchedItemTypes.slice(0, 3).join(', ') || 'some items'}) isn't in the catalog, so adjust the breakdown if needed.`
      setStatus({
        tone: 'success',
        message: `Autofilled from RR ${referenceNo} (${summary.itemCount} item row(s), ${formatKg(summary.totalNetWeight)} net weight). ${coverageNote} Also added to the Report.`,
      })
      onRrSelected?.(summary)
    } catch (err) {
      setRrError(err.message)
    } finally {
      setRrLoading(false)
    }
  }

  const previewNumber = useMemo(() => generateCertificateNumber(form.certificateType, form), [form])
  const preview = useMemo(() => normalizeCertificateData(form, { certificateNumber: previewNumber }), [form, previewNumber])

  /** Validate + build the PDF. Returns { ok:true, blob, filename } or { ok:false }. Never auto-downloads. */
  async function buildCertificate() {
    const validationErrors = validateCertificateForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the certificate.' })
      return { ok: false }
    }
    try {
      const data = normalizeCertificateData(form, { certificateNumber: previewNumber })
      const { blob, filename } = await generateCertificatePdf(data)
      return { ok: true, blob, filename }
    } catch (err) {
      console.error(err)
      setStatus({ tone: 'error', message: 'Something went wrong generating the PDF. Please try again.' })
      return { ok: false }
    }
  }

  useImperativeHandle(ref, () => ({ generate: buildCertificate }))

  async function handleGenerate() {
    setGenerating(true)
    setStatus(null)
    const result = await buildCertificate()
    if (result.ok) {
      downloadBlob(result.blob, result.filename)
      setStatus({ tone: 'success', message: `Certificate generated: ${result.filename}` })
    }
    setGenerating(false)
  }

  const type = form.certificateType

  return (
    <div className="flex flex-col gap-5">
      <Card title="Certificate Type">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CERTIFICATE_TYPE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                type === t.id
                  ? 'border-brand-green bg-brand-green-light text-brand-green-dark ring-1 ring-brand-green'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {t.label}
              <span className="mt-0.5 block text-[11px] font-normal text-gray-400">{t.prefix}-YYYY-####</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Load from Receiving Report" subtitle="Source of truth: the RR consolidation Google Sheet. Autofills recipient/address/weight only.">
        <div className="mb-4 border-b border-gray-100 pb-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Load from Receiving Reports</div>
          <p className="mb-2 text-xs text-gray-400">Pull every RR received in a date range straight from the Google Sheet, to narrow the RR Number list below.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Received From">
              <TextInput type="date" value={rrRangeStart} onChange={(e) => setRrRangeStart(e.target.value)} />
            </FormField>
            <FormField label="Received To">
              <TextInput type="date" value={rrRangeEnd} onChange={(e) => setRrRangeEnd(e.target.value)} />
            </FormField>
            <div className="flex items-end">
              <PrimaryButton type="button" onClick={handleLoadRrRange} loading={rrRangeLoading} className="w-full">
                {rrRangeLoading ? 'Loading…' : 'Load RRs in range'}
              </PrimaryButton>
            </div>
          </div>
          {rrRangeError && (
            <div className="mt-2">
              <Banner tone="error">{rrRangeError}</Banner>
            </div>
          )}
          {rrFilteredNumbers && !rrRangeError && (
            <p className="mt-2 text-xs text-gray-400">
              Showing {rrFilteredNumbers.length} RR(s) received {rrRangeStart} to {rrRangeEnd}.{' '}
              <button
                type="button"
                onClick={() => setRrFilteredNumbers(null)}
                className="font-medium text-brand-green hover:underline"
              >
                Clear filter
              </button>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <FormField label="RR Number" hint={rrOptionList.length ? `${rrOptionList.length} RR number(s) available` : 'Loading…'}>
              <TextInput
                list="rr-number-options"
                value={rrInput}
                onChange={(e) => handleRrSelect(e.target.value)}
                placeholder="Start typing an RR number, e.g. S18516"
              />
              <datalist id="rr-number-options">
                {rrOptionList.map((rr) => (
                  <option key={rr} value={rr} />
                ))}
              </datalist>
            </FormField>
          </div>
          {rrLoading && <span className="pb-2.5 text-xs text-gray-400">Loading…</span>}
        </div>
        {rrError && <Banner tone="error">{rrError}</Banner>}
        {rrSummary && (
          <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>{rrSummary.referenceNo}</strong> — {rrSummary.accountName} · {rrSummary.itemCount} item row(s) ·{' '}
            {formatKg(rrSummary.totalNetWeight)} net weight · received {rrSummary.receivedDate || '—'}
            {rrSummary.itemTypes.length > 0 && <> · {rrSummary.itemTypes.slice(0, 5).join(', ')}</>}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Certificate Details">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Recipient / Company Name" error={errors.recipient}>
                <TextInput
                  value={form.recipient}
                  onChange={(e) => setField('recipient', e.target.value)}
                  placeholder="Acme Corporation"
                  className={inputErrorClass(errors.recipient)}
                />
              </FormField>
              <FormField label="Company Address" hint="Optional">
                <TextInput value={form.companyAddress} onChange={(e) => setField('companyAddress', e.target.value)} placeholder="City, Country" />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
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
              <FormField label="Certificate Date" error={errors.givenDate} hint='"Given this day, …"'>
                <TextInput
                  type="date"
                  value={form.givenDate}
                  onChange={(e) => setField('givenDate', e.target.value)}
                  className={inputErrorClass(errors.givenDate)}
                />
              </FormField>
            </div>

            <FormField label="Certificate Sequence No." hint={`Formats as ${previewNumber}`}>
              <TextInput type="number" min="1" value={form.sequenceNumber} onChange={(e) => setField('sequenceNumber', e.target.value)} className="w-32" />
            </FormField>

            {errors.impact && <p className="text-xs text-red-600">{errors.impact}</p>}

            {(type === 'CAC' || type === 'LDC') && (
              <FormField label="Materials Collected (kg)" error={errors.materialsCollectedKg} hint="Leave blank to auto-sum from material breakdown below">
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.materialsCollectedKg}
                  onChange={(e) => setField('materialsCollectedKg', e.target.value)}
                  className={inputErrorClass(errors.materialsCollectedKg)}
                />
              </FormField>
            )}

            {(type === 'EIC' || type === 'LDC') && (
              <FormField label="Landfill Diverted (kg)" hint="Leave blank to reuse Materials Collected">
                <TextInput type="number" inputMode="decimal" value={form.landfillDivertedKg} onChange={(e) => setField('landfillDivertedKg', e.target.value)} />
              </FormField>
            )}

            {(type === 'EIC' || type === 'CAC' || type === 'LDC') && (
              <div className="border-t border-gray-100 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Material Breakdown</div>
                {errors.materialsBreakdown && <p className="mb-2 text-xs text-red-600">{errors.materialsBreakdown}</p>}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['metalKg', 'Metal (kg)'],
                    ['plasticKg', 'Plastic (kg)'],
                    ['glassKg', 'Glass (kg)'],
                    ['electronicsKg', 'Electronics (kg)'],
                  ].map(([key, label]) => (
                    <FormField key={key} label={label}>
                      <TextInput type="number" inputMode="decimal" value={form.materials[key]} onChange={(e) => setMaterial(key, e.target.value)} />
                    </FormField>
                  ))}
                </div>
              </div>
            )}

            {(type === 'EIC' || type === 'CAC') && (
              <div className="border-t border-gray-100 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Carbon — computed from Material Breakdown</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ComputedField label="Total Carbon Footprint (kg CO2e)" value={formatNumber(preview.totalCarbonFootprintKgCO2e)} />
                  <ComputedField label="Recycled Emissions (kg CO2e)" value={formatNumber(preview.recycledEmissionsKgCO2e)} />
                </div>
                <p className="mt-1.5 text-xs text-gray-400">Net Carbon Abated: {formatUnit(preview.netCarbonAbatedKgCO2e, 'kg CO2e')}</p>
              </div>
            )}

            {type === 'EIC' && (
              <div className="border-t border-gray-100 pt-4">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Environmental Savings — Water/Energy computed from Landfill Diverted (kg)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <ComputedField label="Water Saved (L)" value={formatNumber(preview.waterSavedLiters, 0)} />
                  <ComputedField label="Energy Saved (kWh)" value={formatNumber(preview.energySavedKwh)} />
                  <FormField label="Trees Saved" hint="Manual — no established formula">
                    <TextInput type="number" inputMode="decimal" value={form.treesSaved} onChange={(e) => setField('treesSaved', e.target.value)} />
                  </FormField>
                </div>
              </div>
            )}

            {type === 'RPC' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Total Received Volume (kg)" error={errors.totalReceivedVolumeKg}>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    value={form.totalReceivedVolumeKg}
                    onChange={(e) => setField('totalReceivedVolumeKg', e.target.value)}
                    className={inputErrorClass(errors.totalReceivedVolumeKg)}
                  />
                </FormField>
                <FormField label="Rigid Plastic (kg)" error={errors.rigidPlasticKg}>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    value={form.rigidPlasticKg}
                    onChange={(e) => setField('rigidPlasticKg', e.target.value)}
                    className={inputErrorClass(errors.rigidPlasticKg)}
                  />
                </FormField>
                <FormField label="Flexible Plastic (kg)">
                  <TextInput type="number" inputMode="decimal" value={form.flexiblePlasticKg} onChange={(e) => setField('flexiblePlasticKg', e.target.value)} />
                </FormField>
                <p className="col-span-full text-xs text-gray-400">Plastic Waste is derived automatically: {formatKg(preview.plasticWasteKg)}</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Environmental Impact Preview">
          <CertificatePreviewTiles type={type} preview={preview} />
        </Card>

        <Card title={`Preview ${CERTIFICATE_TYPE_LIST.find((t) => t.id === type)?.label ?? 'Certificate'}`}>
          <div className="space-y-1.5 text-sm">
            <Row label="Certificate No." value={previewNumber} />
            <Row label="Recipient" value={form.recipient} />
            <Row label="Reporting Period" value={preview.reportingPeriodLabel} />
          </div>
        </Card>

        {!hideActions && (
          <Card>
            <div className="flex flex-col gap-3">
              {status && <Banner tone={status.tone}>{status.message}</Banner>}
              <PrimaryButton type="button" onClick={handleGenerate} loading={generating}>
                {generating ? 'Generating…' : 'Generate PDF Certificate'}
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

function CertificatePreviewTiles({ type, preview }) {
  const tiles = useMemo(() => {
    switch (type) {
      case 'CAC':
        return [
          ['Materials Collected', formatKg(preview.materialsCollectedKg)],
          ['Total Carbon Footprint', formatUnit(preview.totalCarbonFootprintKgCO2e, 'kg CO2e')],
          ['Net Carbon Abated', formatUnit(preview.netCarbonAbatedKgCO2e / 1000, 'tCO2e')],
          ['Recycled Emissions', formatUnit(preview.recycledEmissionsKgCO2e, 'kg CO2e')],
          ['Carbon Benefits Equivalent', `~${formatNumber(preview.kmAvoided, 0)} km avoided`],
        ]
      case 'LDC':
        return [
          ['Materials Collected', formatKg(preview.materialsCollectedKg)],
          ['Landfill Diverted', formatKg(preview.landfillDivertedKg)],
        ]
      case 'RPC':
        return [
          ['Total Received Volume', formatKg(preview.totalReceivedVolumeKg)],
          ['Plastic Waste', formatKg(preview.plasticWasteKg)],
          ['Rigid Plastic', formatKg(preview.rigidPlasticKg)],
          ['Flexible Plastic', formatKg(preview.flexiblePlasticKg)],
        ]
      case 'EIC':
      default:
        return [
          ['Carbon Saved', formatUnit(preview.netCarbonAbatedKgCO2e, 'kg CO2e')],
          ['Landfill Diverted', formatKg(preview.landfillDivertedKg)],
          ['Plastic Recycled', formatKg(preview.plasticRecycledKg)],
          ['Water Saved', formatUnit(preview.waterSavedLiters, 'L', 0)],
          ['Energy Saved', formatUnit(preview.energySavedKwh, 'kWh')],
          ...(preview.treesSaved > 0 ? [['Trees Saved', formatNumber(preview.treesSaved, 0)]] : []),
        ]
    }
  }, [type, preview])

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-brand-green/15 bg-brand-green-light px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-brand-green/70">{label}</div>
          <div className="mt-0.5 text-lg font-semibold text-brand-green-dark">{value}</div>
        </div>
      ))}
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

/** A non-editable value derived by the app (never typed directly), styled like a disabled input. */
function ComputedField({ label, value }) {
  return (
    <FormField label={label}>
      <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">{value}</div>
    </FormField>
  )
}
