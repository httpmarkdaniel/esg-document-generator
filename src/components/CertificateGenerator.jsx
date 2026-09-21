import { useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput, inputErrorClass } from './FormField.jsx'
import { ImpactPreviewGrid } from './ImpactPreviewGrid.jsx'
import {
  emptyCertificateForm,
  validateCertificateForm,
  normalizeCertificateData,
  generateCertificateNumber,
} from '../certificate/certificateData.js'
import { generateCertificatePdf } from '../certificate/generateCertificatePdf.js'
import { downloadBlob } from '../lib/download.js'
import { todayIso } from '../lib/format.js'

export function CertificateGenerator() {
  const [form, setForm] = useState({ ...emptyCertificateForm(), calculationDate: todayIso() })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null) // { tone, message }
  const [generating, setGenerating] = useState(false)

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setMaterial(index, key, value) {
    setForm((f) => {
      const materials = [...f.materials]
      materials[index] = { ...materials[index], [key]: value }
      return { ...f, materials }
    })
  }

  function addMaterial() {
    setForm((f) => ({ ...f, materials: [...f.materials, { material: '', weightKg: '' }] }))
  }

  function removeMaterial(index) {
    setForm((f) => ({ ...f, materials: f.materials.filter((_, i) => i !== index) }))
  }

  async function handleGenerate() {
    const validationErrors = validateCertificateForm(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) {
      setStatus({ tone: 'error', message: 'Fix the highlighted fields before generating the certificate.' })
      return
    }

    setGenerating(true)
    setStatus(null)
    try {
      const certificateNumber = generateCertificateNumber()
      const data = normalizeCertificateData(form, { certificateNumber })
      const { blob, filename } = generateCertificatePdf(data)
      downloadBlob(blob, filename)
      setStatus({ tone: 'success', message: `Certificate generated: ${filename}` })
    } catch (err) {
      console.error(err)
      setStatus({ tone: 'error', message: 'Something went wrong generating the PDF. Please try again.' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Certificate Details" subtitle="One certificate covers a single calculation / transaction.">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Recipient" error={errors.recipient}>
              <TextInput
                value={form.recipient}
                onChange={(e) => setField('recipient', e.target.value)}
                placeholder="Acme Corporation"
                className={inputErrorClass(errors.recipient)}
              />
            </FormField>
            <FormField label="Reference / Transaction" error={errors.reference}>
              <TextInput
                value={form.reference}
                onChange={(e) => setField('reference', e.target.value)}
                placeholder="TXN-00123"
                className={inputErrorClass(errors.reference)}
              />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Item" error={errors.item}>
              <TextInput
                value={form.item}
                onChange={(e) => setField('item', e.target.value)}
                placeholder="Mixed scrap metal"
                className={inputErrorClass(errors.item)}
              />
            </FormField>
            <FormField label="Quantity" hint="Optional">
              <TextInput value={form.quantity} onChange={(e) => setField('quantity', e.target.value)} placeholder="e.g. 12 pallets" />
            </FormField>
          </div>

          <FormField label="Calculation Date" error={errors.calculationDate}>
            <TextInput
              type="date"
              value={form.calculationDate}
              onChange={(e) => setField('calculationDate', e.target.value)}
              className={inputErrorClass(errors.calculationDate)}
            />
          </FormField>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Environmental Impact</div>
            {errors.impact && <p className="mb-2 text-xs text-red-600">{errors.impact}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['netWeightKg', 'Net Weight (kg)'],
                ['carbonAbatedKgCO2e', 'Carbon Abated (kg CO2e)'],
                ['waterSavedLiters', 'Water Saved (L)'],
                ['energySavedKwh', 'Energy Saved (kWh)'],
                ['landfillAvertedKg', 'Landfill Averted (kg)'],
              ].map(([key, label]) => (
                <FormField key={key} label={label}>
                  <TextInput
                    type="number"
                    inputMode="decimal"
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    placeholder="0"
                  />
                </FormField>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Material Composition (optional)</span>
              <GhostButton type="button" onClick={addMaterial}>
                + Add material
              </GhostButton>
            </div>
            {form.materials.length === 0 && <p className="text-xs text-gray-400">No materials added.</p>}
            <div className="grid gap-2">
              {form.materials.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput
                    value={m.material}
                    onChange={(e) => setMaterial(i, 'material', e.target.value)}
                    placeholder="Material (e.g. Aluminum)"
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
            </div>
          </div>

          <FormField label="Calculation Methodology / Version" hint="Optional — shown on the certificate footer">
            <TextInput
              value={form.methodologyVersion}
              onChange={(e) => setField('methodologyVersion', e.target.value)}
              placeholder="e.g. v2.1"
            />
          </FormField>
        </div>
      </Card>

      <div className="flex flex-col gap-5">
        <Card title="Environmental Impact Preview">
          <ImpactPreviewGrid
            netWeightKg={form.netWeightKg}
            carbonAbatedKgCO2e={form.carbonAbatedKgCO2e}
            waterSavedLiters={form.waterSavedLiters}
            energySavedKwh={form.energySavedKwh}
            landfillAvertedKg={form.landfillAvertedKg}
          />
        </Card>

        <Card title="Preview Certificate">
          <div className="space-y-1.5 text-sm">
            <Row label="Recipient" value={form.recipient} />
            <Row label="Reference" value={form.reference} />
            <Row label="Item" value={form.item} />
            <Row label="Date" value={form.calculationDate} />
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            {status && <Banner tone={status.tone}>{status.message}</Banner>}
            <PrimaryButton type="button" onClick={handleGenerate} loading={generating}>
              {generating ? 'Generating…' : 'Generate PDF Certificate'}
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
