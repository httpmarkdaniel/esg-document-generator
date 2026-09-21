// ESG Report data model.
//
// ESGReportData is the internal shape that feeds the DOCX generator — it is
// NOT itself the deliverable (the .docx file is). Keeping it as an explicit
// shape means reportTemplate.js / generateReportDocx.js can be swapped out
// for an official template later without touching how report data is
// collected or aggregated.

import { toNumber, toText } from '../lib/format.js'

/** @returns {object} a blank report form's default values */
export function emptyReportForm() {
  return {
    title: 'Environmental Impact Report',
    periodStart: '',
    periodEnd: '',
    organization: '',
    filters: { client: '', vendor: '', project: '', auction: '', branch: '' },
    transactions: [], // [{ calculationId, reference, date, description, quantity, netWeightKg, carbonAbatedKgCO2e, waterSavedLiters, energySavedKwh, landfillAvertedKg }]
    materials: [], // [{ material, weightKg }]
    primaryMaterialEmissionsKgCO2e: '',
    recyclingEmissionsKgCO2e: '',
    methodologyVersion: '',
    methodologySource: '',
    assumptions: '',
  }
}

export function emptyTransactionRow() {
  return {
    calculationId: '',
    reference: '',
    date: '',
    description: '',
    quantity: '',
    netWeightKg: '',
    carbonAbatedKgCO2e: '',
    waterSavedLiters: '',
    energySavedKwh: '',
    landfillAvertedKg: '',
  }
}

export function emptyMaterialRow() {
  return { material: '', weightKg: '' }
}

/**
 * Validate a report form. Returns a map of field -> error message.
 * An empty object means the form is valid.
 */
export function validateReportForm(form) {
  const errors = {}
  if (!toText(form.periodStart, '').trim()) errors.periodStart = 'Start date is required.'
  if (!toText(form.periodEnd, '').trim()) errors.periodEnd = 'End date is required.'
  if (form.periodStart && form.periodEnd && new Date(form.periodStart) > new Date(form.periodEnd)) {
    errors.periodEnd = 'End date must be on or after the start date.'
  }

  const realTransactions = (form.transactions || []).filter((t) => toText(t.reference, '').trim() || toText(t.description, '').trim())
  if (!realTransactions.length) {
    errors.transactions = 'Add at least one transaction for this reporting period.'
  }

  return errors
}
