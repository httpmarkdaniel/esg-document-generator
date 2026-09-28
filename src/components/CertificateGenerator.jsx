import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
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
import { formatKg, formatNumber, formatUnit, kgString, todayIso } from '../lib/format.js'
import { combineRrSummaries } from '../rrData/rrClient.js'
import { RrMultiPicker } from './RrMultiPicker.jsx'
import { CertificatePreviewEditor } from './CertificatePreviewEditor.jsx'
import { withoutDataOverrides } from '../certificate/certificateText.js'
import { loadDesigns, saveDesign } from '../lib/designStore.js'

export const CertificateGenerator = forwardRef(function CertificateGenerator(
  { prefillCalculation, onPrefillConsumed, onRrsSelected, hideActions = false },
  ref,
) {
  const [form, setForm] = useState({ ...emptyCertificateForm(), periodStart: todayIso(), periodEnd: todayIso(), givenDate: todayIso() })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [generating, setGenerating] = useState(false)

  const [rrSummary, setRrSummary] = useState(null)
  // Text edits made in the preview editor, key -> text (see certificateText.js).
  const [textOverrides, setTextOverrides] = useState({})
  // Images added in the preview editor (e.g. a client logo): { id, name, dataUrl, x, y, w, h } in mm.
  const [placedImages, setPlacedImages] = useState([])
  // Bumped to reset the RR picker (its ticks and filters) after "Clear RRs".
  const [pickerKey, setPickerKey] = useState(0)
  // Custom (Canva) designs, one per certificate type, remembered in the browser (see lib/designStore.js).
  const [designs, setDesigns] = useState({})
  const saveTimers = useRef({})

  useEffect(() => {
    loadDesigns().then((saved) => setDesigns((current) => ({ ...saved, ...current })))
  }, [])

  function setDesign(type, design) {
    setDesigns((current) => ({ ...current, [type]: design }))
    // Dragging a field changes the design many times a second — save once it settles.
    clearTimeout(saveTimers.current[type])
    saveTimers.current[type] = setTimeout(() => saveDesign(type, design), 500)
  }

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
    setTextOverrides(withoutDataOverrides)
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

  // Several RRs can go on one certificate: their weights and material
  // breakdowns are summed (combineRrSummaries), and each RR is also added to
  // the Report as its own row.
  function handleRrsApply(summaries) {
    const summary = combineRrSummaries(summaries)
    setRrSummary(summary)
    setTextOverrides(withoutDataOverrides)
    setForm((f) => ({
      ...f,
      recipient: summary.accountName || f.recipient,
      companyAddress: summary.pickupAddress || summary.billingAddress || f.companyAddress,
      materialsCollectedKg: kgString(summary.totalNetWeight),
      landfillDivertedKg: kgString(summary.totalNetWeight),
      materials: {
        metalKg: kgString(summary.materialsKg.metalKg),
        plasticKg: kgString(summary.materialsKg.plasticKg),
        glassKg: kgString(summary.materialsKg.glassKg),
        electronicsKg: kgString(summary.materialsKg.electronicsKg),
      },
    }))
    const matchedPct = formatNumber(summary.materialsMatchedFraction * 100, 0)
    const coverageNote =
      summary.materialsMatchedFraction >= 0.999
        ? 'Material Breakdown auto-filled from the material split catalog — Carbon now computes automatically too.'
        : `Material Breakdown auto-filled from the material split catalog for ${matchedPct}% of the weight (by item type) — the rest (${summary.unmatchedItemTypes.slice(0, 3).join(', ') || 'some items'}) isn't in the catalog, so adjust the breakdown if needed.`
    const rrLabel = summary.rrCount === 1 ? `RR ${summary.referenceNo}` : `${summary.rrCount} RRs`
    const accountNote =
      summary.accountNames.length > 1
        ? ` Heads up: these RRs belong to ${summary.accountNames.length} different accounts (${summary.accountNames.slice(0, 3).join(', ')}${summary.accountNames.length > 3 ? ', …' : ''}) — Recipient was set to the first one, check it.`
        : ''
    setStatus({
      tone: summary.accountNames.length > 1 ? 'info' : 'success',
      message: `Autofilled from ${rrLabel} (${summary.itemCount} item row(s), ${formatKg(summary.totalNetWeight)} net weight). ${coverageNote} Also added to the Report.${accountNote}`,
    })
    onRrsSelected?.(summaries)
  }

  /**
   * Undo "Use RRs on this certificate": empty the fields the RRs filled in
   * (recipient, address, weights, material breakdown) and reset the picker.
   * RR rows already sent to the ESG Report stay there (it has its own Clear RRs).
   */
  function clearRrs() {
    const count = rrSummary?.rrCount ?? 0
    setRrSummary(null)
    setForm((f) => ({
      ...f,
      recipient: '',
      companyAddress: '',
      materialsCollectedKg: '',
      landfillDivertedKg: '',
      materials: { metalKg: '', plasticKg: '', glassKg: '', electronicsKg: '' },
    }))
    setTextOverrides(withoutDataOverrides)
    setPickerKey((k) => k + 1)
    setStatus({ tone: 'info', message: `Cleared ${count} RR(s) from the certificate.` })
  }

  const previewNumber = useMemo(() => generateCertificateNumber(form.certificateType, form), [form])
  const preview = useMemo(() => normalizeCertificateData(form, { certificateNumber: previewNumber }), [form, previewNumber])
  const certificateData = useMemo(() => ({ ...preview, textOverrides }), [preview, textOverrides])
  const design = designs[form.certificateType] ?? null

  /** Validate + build the PDF. Returns { ok:true, blob, filename } or { ok:false }. Never auto-downloads. */
  async function buildCertificate() {
    const validationErrors = validateCertificateForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the certificate.' })
      return { ok: false }
    }
    try {
      const data = { ...normalizeCertificateData(form, { certificateNumber: previewNumber }), textOverrides, placedImages, customDesign: design }
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

      <Card
        title="Load from Receiving Reports"
        subtitle="Source of truth: the RR consolidation Google Sheet. Tick one or more RRs — their weights are combined into this one certificate. Autofills recipient/address/weight only."
      >
        <RrMultiPicker key={pickerKey} applyLabel={(n) => (n > 1 ? `Use ${n} RRs on this certificate` : 'Use this RR on the certificate')} onApply={handleRrsApply} />
        {rrSummary && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <strong>{rrSummary.rrCount === 1 ? rrSummary.referenceNo : `${rrSummary.rrCount} RRs: ${rrSummary.referenceNo}`}</strong> —{' '}
            {rrSummary.accountNames.join(', ') || '—'} · {rrSummary.itemCount} item row(s) · {formatKg(rrSummary.totalNetWeight)} net weight · received{' '}
            {rrSummary.receivedDateFromIso === rrSummary.receivedDateToIso
              ? rrSummary.receivedDateFromIso || '—'
              : `${rrSummary.receivedDateFromIso} to ${rrSummary.receivedDateToIso}`}
            {rrSummary.itemTypes.length > 0 && <> · {rrSummary.itemTypes.slice(0, 5).join(', ')}</>}
            <div className="mt-2 flex justify-end">
              <GhostButton type="button" onClick={clearRrs} className="hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                Clear RRs
              </GhostButton>
            </div>
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
                {rrSummary && rrSummary.unmatchedItemTypes.length > 0 && (
                  <p className="mb-2 text-xs font-medium text-amber-700">
                    Not found in catalog, please input manually — {rrSummary.unmatchedItemTypes.slice(0, 6).join(', ')}
                    {rrSummary.unmatchedItemTypes.length > 6 ? ', …' : ''}
                  </p>
                )}
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

      </div>

      {/* Status + Generate sit right above the certificate preview, so they're seen before generating. */}
      <CertificatePreviewEditor
        data={certificateData}
        overrides={textOverrides}
        onOverridesChange={setTextOverrides}
        images={placedImages}
        onImagesChange={setPlacedImages}
        design={design}
        onDesignChange={(d) => setDesign(form.certificateType, d)}
        actions={
          (status || !hideActions) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">{status && <Banner tone={status.tone}>{status.message}</Banner>}</div>
              {!hideActions && (
                <PrimaryButton type="button" onClick={handleGenerate} loading={generating} className="shrink-0 sm:w-64">
                  {generating ? 'Generating…' : 'Generate PDF Certificate'}
                </PrimaryButton>
              )}
            </div>
          )
        }
      />
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

/** A non-editable value derived by the app (never typed directly), styled like a disabled input. */
function ComputedField({ label, value }) {
  return (
    <FormField label={label}>
      <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-700">{value}</div>
    </FormField>
  )
}
