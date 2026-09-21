// Certificate data model: the single source of truth for what a certificate
// contains. The template/renderer only ever reads from a normalized
// CertificateData object built by `normalizeCertificateData`.
//
// Keeping this separate from certificateTemplate.js means the visual design
// can be replaced later (see certificateTemplate.js) without touching how
// the data is shaped or validated.

import { toNumber, toText } from '../lib/format.js'

/** @returns {object} a blank certificate form's default values */
export function emptyCertificateForm() {
  return {
    recipient: '',
    reference: '',
    item: '',
    quantity: '',
    calculationDate: '',
    netWeightKg: '',
    carbonAbatedKgCO2e: '',
    waterSavedLiters: '',
    energySavedKwh: '',
    landfillAvertedKg: '',
    methodologyVersion: '',
    materials: [], // [{ material, weightKg }]
  }
}

/**
 * Validate a certificate form. Returns a map of field -> error message.
 * An empty object means the form is valid.
 */
export function validateCertificateForm(form) {
  const errors = {}
  if (!toText(form.recipient, '').trim()) errors.recipient = 'Recipient is required.'
  if (!toText(form.reference, '').trim()) errors.reference = 'Reference / transaction is required.'
  if (!toText(form.item, '').trim()) errors.item = 'Item description is required.'
  if (!toText(form.calculationDate, '').trim()) errors.calculationDate = 'Calculation date is required.'

  const hasAnyImpact = [
    form.netWeightKg,
    form.carbonAbatedKgCO2e,
    form.waterSavedLiters,
    form.energySavedKwh,
    form.landfillAvertedKg,
  ].some((v) => toNumber(v) > 0)
  if (!hasAnyImpact) {
    errors.impact = 'Enter at least one environmental impact value greater than zero.'
  }

  return errors
}

/**
 * Normalize a raw certificate form into the clean shape the PDF template
 * consumes. Every numeric field is coerced to a finite number; every text
 * field falls back to an em dash rather than printing "undefined"/"null".
 */
export function normalizeCertificateData(form, { certificateNumber } = {}) {
  return {
    certificateNumber: toText(certificateNumber, '—'),
    recipient: toText(form.recipient),
    reference: toText(form.reference),
    item: toText(form.item),
    quantity: toText(form.quantity, ''),
    calculationDate: form.calculationDate || null,
    netWeightKg: toNumber(form.netWeightKg),
    carbonAbatedKgCO2e: toNumber(form.carbonAbatedKgCO2e),
    waterSavedLiters: toNumber(form.waterSavedLiters),
    energySavedKwh: toNumber(form.energySavedKwh),
    landfillAvertedKg: toNumber(form.landfillAvertedKg),
    methodologyVersion: toText(form.methodologyVersion, ''),
    materials: (form.materials || [])
      .filter((m) => toText(m.material, '').trim())
      .map((m) => ({ material: toText(m.material), weightKg: toNumber(m.weightKg) })),
    generatedAt: new Date().toISOString(),
  }
}

/** Deterministic-looking certificate number for the temporary template. */
export function generateCertificateNumber(date = new Date()) {
  const year = date.getFullYear()
  const stamp = Math.floor(date.getTime() % 1e6)
    .toString()
    .padStart(6, '0')
  return `ESG-${year}-${stamp}`
}
