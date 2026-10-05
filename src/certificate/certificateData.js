// Certificate data model: the single source of truth for what any of the
// five certificate types contains. Templates only ever read from a
// normalized CertificateData object built by `normalizeCertificateData`.
//
// Keeping this separate from certificateTemplate.js means the visual design
// can be replaced later without touching how the data is shaped, derived,
// or validated.

import { toNumber, toText, formatDate } from '../lib/format.js'
import { CERTIFICATE_TYPES, KM_PER_KG_CO2E } from '../lib/brand.js'
import { calculateCarbonFromMaterialWeights, calculateSavingsFromNetWeight } from '../calculator/calculatorEngine.js'

/** @returns {object} a blank certificate form's default values (superset of all 5 types) */
export function emptyCertificateForm() {
  return {
    certificateType: 'EIC',
    sequenceNumber: '1',
    recipient: '',
    companyAddress: '',
    receivingReport: '',
    periodStart: '',
    periodEnd: '',
    givenDate: '',
    materialsCollectedKg: '',
    landfillDivertedKg: '',
    treesSaved: '',
    materials: { metalKg: '', plasticKg: '', glassKg: '', electronicsKg: '' },
    totalReceivedVolumeKg: '',
    rigidPlasticKg: '',
    flexiblePlasticKg: '',
  }
}

/**
 * Validate a certificate form for its selected type. Returns a map of
 * field -> error message. An empty object means the form is valid.
 */
export function validateCertificateForm(form) {
  const errors = {}
  if (!toText(form.recipient, '').trim()) errors.recipient = 'Recipient / company name is required.'
  if (!toText(form.periodStart, '').trim()) errors.periodStart = 'Reporting period start is required.'
  if (!toText(form.periodEnd, '').trim()) errors.periodEnd = 'Reporting period end is required.'
  if (form.periodStart && form.periodEnd && new Date(form.periodStart) > new Date(form.periodEnd)) {
    errors.periodEnd = 'Period end must be on or after the start date.'
  }
  if (!toText(form.givenDate, '').trim()) errors.givenDate = 'Certificate date is required.'

  const hasMaterials = [form.materials.metalKg, form.materials.plasticKg, form.materials.glassKg, form.materials.electronicsKg].some(
    (v) => toNumber(v) > 0,
  )

  switch (form.certificateType) {
    case 'CAC': {
      if (!hasMaterials) {
        errors.materialsBreakdown = 'Enter a material breakdown — carbon footprint is computed from it.'
      }
      break
    }
    case 'LDC': {
      if (toNumber(form.materialsCollectedKg) <= 0 && !hasMaterials) {
        errors.materialsCollectedKg = 'Enter materials collected or at least one material breakdown value.'
      }
      break
    }
    case 'RPC': {
      if (toNumber(form.totalReceivedVolumeKg) <= 0) errors.totalReceivedVolumeKg = 'Total received volume is required.'
      if (toNumber(form.rigidPlasticKg) <= 0 && toNumber(form.flexiblePlasticKg) <= 0) {
        errors.rigidPlasticKg = 'Enter rigid and/or flexible plastic weight.'
      }
      break
    }
    case 'EIC':
    default: {
      const hasAnyImpact = [form.landfillDivertedKg, form.materialsCollectedKg, ...Object.values(form.materials)].some((v) => toNumber(v) > 0)
      if (!hasAnyImpact) errors.impact = 'Enter landfill diverted, materials collected, or a material breakdown value greater than zero.'
      break
    }
  }

  return errors
}

/** "January to December 2025" / "January to April 2025" / "December 2025" style label. */
export function formatReportingPeriod(periodStart, periodEnd) {
  if (!periodStart && !periodEnd) return '—'
  const start = periodStart ? new Date(periodStart) : null
  const end = periodEnd ? new Date(periodEnd) : start
  if (!start || Number.isNaN(start.getTime())) return '—'
  const startMonth = start.toLocaleDateString('en-US', { month: 'long' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' })
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (startYear === endYear && startMonth === endMonth) return `${startMonth} ${startYear}`
  if (startYear === endYear) return `${startMonth} to ${endMonth} ${startYear}`
  return `${startMonth} ${startYear} to ${endMonth} ${endYear}`
}

/** "on February 28, 2025" / "from January 5, 2026 to February 2, 2026" — the "Items collected …" line (dates the RRs were received). */
export function formatItemsCollected(periodStart, periodEnd) {
  const start = formatDate(periodStart, '')
  const end = formatDate(periodEnd, '')
  if (!start && !end) return '—'
  if (!start || !end || start === end) return `on ${start || end}`
  return `from ${start} to ${end}`
}

/**
 * Normalize a raw certificate form into the clean, fully-derived shape the
 * PDF templates consume. Every numeric field is coerced to a finite number;
 * every text field falls back to an em dash rather than printing
 * "undefined"/"null". Net carbon / km-avoided / plastic-waste are always
 * derived here, never typed by the user, so every template stays consistent.
 */
export function normalizeCertificateData(form, { certificateNumber } = {}) {
  const materials = {
    metalKg: toNumber(form.materials?.metalKg),
    plasticKg: toNumber(form.materials?.plasticKg),
    glassKg: toNumber(form.materials?.glassKg),
    electronicsKg: toNumber(form.materials?.electronicsKg),
  }
  const materialsTotalKg = materials.metalKg + materials.plasticKg + materials.glassKg + materials.electronicsKg

  // Carbon is always derived from the material breakdown — never typed
  // directly — using the same factors as the Impact Calculator.
  const { totalCarbonFootprintKgCO2e, recycledEmissionsKgCO2e, netCarbonAbatedKgCO2e } = calculateCarbonFromMaterialWeights(materials)
  const kmAvoided = netCarbonAbatedKgCO2e > 0 ? netCarbonAbatedKgCO2e * KM_PER_KG_CO2E : 0

  // Water/energy only depend on net weight (not material composition), so
  // they're derivable as soon as a net weight is known — e.g. straight
  // from an RR, before any material breakdown has been entered.
  const netWeightForSavings = toNumber(form.landfillDivertedKg) || toNumber(form.materialsCollectedKg) || materialsTotalKg
  const { waterSavedLiters, energySavedKwh } = calculateSavingsFromNetWeight(netWeightForSavings)

  const rigidPlasticKg = toNumber(form.rigidPlasticKg)
  const flexiblePlasticKg = toNumber(form.flexiblePlasticKg)

  return {
    certificateType: form.certificateType,
    certificateNumber: toText(certificateNumber, '—'),
    recipient: toText(form.recipient),
    companyAddress: toText(form.companyAddress, ''),
    periodStart: form.periodStart || null,
    periodEnd: form.periodEnd || null,
    reportingPeriodLabel: formatReportingPeriod(form.periodStart, form.periodEnd),
    receivingReport: toText(form.receivingReport, ''),
    itemsCollectedLabel: formatItemsCollected(form.periodStart, form.periodEnd),
    givenDate: form.givenDate || null,
    givenDateLabel: formatDate(form.givenDate),

    materialsCollectedKg: toNumber(form.materialsCollectedKg) || materialsTotalKg,
    landfillDivertedKg: toNumber(form.landfillDivertedKg) || toNumber(form.materialsCollectedKg) || materialsTotalKg,

    totalCarbonFootprintKgCO2e,
    recycledEmissionsKgCO2e,
    netCarbonAbatedKgCO2e,
    kmAvoided,

    waterSavedLiters,
    energySavedKwh,
    treesSaved: toNumber(form.treesSaved),
    plasticRecycledKg: materials.plasticKg,

    materials,
    materialsTotalKg,

    totalReceivedVolumeKg: toNumber(form.totalReceivedVolumeKg),
    rigidPlasticKg,
    flexiblePlasticKg,
    plasticWasteKg: rigidPlasticKg + flexiblePlasticKg,

    generatedAt: new Date().toISOString(),
  }
}

// Types already moved to the current EnviroCycle (Canva) numbering, e.g. "EPI-LDC2026-00004".
const EPI_NUMBERED_TYPES = new Set(['CAC', 'LDC'])

/** Certificate number in the real template's style: "EPI-LDC2026-00004" (CAC/LDC) or "EIC-2025-0001" (the rest). */
export function generateCertificateNumber(certificateType, form) {
  const type = CERTIFICATE_TYPES[certificateType] || CERTIFICATE_TYPES.EIC
  const seq = Math.max(1, Math.trunc(toNumber(form?.sequenceNumber) || 1))
  if (EPI_NUMBERED_TYPES.has(type.id)) {
    // Year the certificate is issued ("Given this day …").
    const year = new Date(form?.givenDate || Date.now()).getFullYear() || new Date().getFullYear()
    return `EPI-${type.prefix}${year}-${String(seq).padStart(5, '0')}`
  }
  const referenceDate = form?.periodEnd || form?.givenDate || new Date().toISOString()
  const year = new Date(referenceDate).getFullYear() || new Date().getFullYear()
  return `${type.prefix}-${year}-${String(seq).padStart(4, '0')}`
}
