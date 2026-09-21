// ESG Report data model, matching the real "Carbon Abatement - Client
// Template.pdf": line items are asset categories, each broken into
// Metal/Plastic/Glass/Electronics weight plus carbon/water/energy/landfill
// impact — not simple transactions.
//
// ESGReportData (built by reportAggregator.js) is the internal shape that
// feeds the DOCX generator — it is NOT itself the deliverable (the .docx
// file is).

import { toText } from '../lib/format.js'
import { REPORT_TITLE } from './methodology.js'

/** @returns {object} a blank report form's default values */
export function emptyReportForm() {
  return {
    title: REPORT_TITLE,
    clientName: '',
    clientAddressLine1: '',
    clientAddressLine2: '',
    clientCityStateZipCountry: '',
    collectionDateRange: '',
    reportIssueDate: '',
    rows: [],
  }
}

// Carbon footprint/recycled emissions/water/energy/landfill-averted are NOT
// part of the row's editable shape — reportAggregator.js always derives
// them from metalKg/plasticKg/glassKg/electronicsKg (carbon) and qtyKg
// (water/energy/landfill), using the same formulas as the Impact
// Calculator. This is what "only material breakdown is manually typed"
// means in practice: there is nothing else to type.
export function emptyAssetCategoryRow() {
  return {
    item: '',
    qtyKg: '',
    metalKg: '',
    plasticKg: '',
    glassKg: '',
    electronicsKg: '',
  }
}

/**
 * Validate a report form. Returns a map of field -> error message.
 * An empty object means the form is valid.
 */
export function validateReportForm(form) {
  const errors = {}
  if (!toText(form.clientName, '').trim()) errors.clientName = 'Client / company name is required.'
  if (!toText(form.reportIssueDate, '').trim()) errors.reportIssueDate = 'Report issue date is required.'

  const realRows = (form.rows || []).filter((r) => toText(r.item, '').trim())
  if (!realRows.length) {
    errors.rows = 'Add at least one asset category row for this report.'
  }

  return errors
}
