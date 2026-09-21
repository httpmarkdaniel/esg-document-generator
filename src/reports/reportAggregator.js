// Aggregates a report form (client info + manually entered asset-category
// rows) into the ESGReportData object the DOCX generator consumes. This is
// the only place that sums/derives values — the template layer only
// formats and lays them out. Net Carbon Abated, the Recycled Materials
// table, and all equivalencies are always derived here, never typed by the
// user, so the generated report stays internally consistent.

import { toNumber, toText, formatDate } from '../lib/format.js'
import { MATERIAL_BENEFIT_TEXT, EQUIVALENCY, KM_PER_KG_CO2E } from '../lib/brand.js'

const NUMERIC_KEYS = [
  'qtyKg',
  'metalKg',
  'plasticKg',
  'glassKg',
  'electronicsKg',
  'carbonFootprintKgCO2e',
  'recycledEmissionsKgCO2e',
  'waterSavedLiters',
  'energySavedKwh',
  'landfillAvertedKg',
]

function sumRows(rows, key) {
  return rows.reduce((acc, r) => acc + r[key], 0)
}

/** Combine the client's address lines into one string, skipping blanks. */
function combineAddress(form) {
  return [form.clientAddressLine1, form.clientAddressLine2, form.clientCityStateZipCountry]
    .map((s) => toText(s, '').trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * @param {ReturnType<import('./reportData.js').emptyReportForm>} form
 */
export function buildEsgReportData(form) {
  const rows = (form.rows || [])
    .filter((r) => toText(r.item, '').trim())
    .map((r, i) => {
      const normalized = { item: toText(r.item, `Asset Category ${i + 1}`) }
      for (const key of NUMERIC_KEYS) normalized[key] = toNumber(r[key])
      normalized.netCarbonAbatedKgCO2e = normalized.carbonFootprintKgCO2e - normalized.recycledEmissionsKgCO2e
      return normalized
    })

  const totals = {
    qtyKg: sumRows(rows, 'qtyKg'),
    metalKg: sumRows(rows, 'metalKg'),
    plasticKg: sumRows(rows, 'plasticKg'),
    glassKg: sumRows(rows, 'glassKg'),
    electronicsKg: sumRows(rows, 'electronicsKg'),
    carbonFootprintKgCO2e: sumRows(rows, 'carbonFootprintKgCO2e'),
    recycledEmissionsKgCO2e: sumRows(rows, 'recycledEmissionsKgCO2e'),
    waterSavedLiters: sumRows(rows, 'waterSavedLiters'),
    energySavedKwh: sumRows(rows, 'energySavedKwh'),
    landfillAvertedKg: sumRows(rows, 'landfillAvertedKg'),
  }
  totals.netCarbonAbatedKgCO2e = totals.carbonFootprintKgCO2e - totals.recycledEmissionsKgCO2e
  totals.materialsTotalKg = totals.metalKg + totals.plasticKg + totals.glassKg + totals.electronicsKg

  const recycledMaterials = ['Metal', 'Plastic', 'Glass', 'Electronics'].map((label) => ({
    material: label,
    quantityKg: totals[`${label.toLowerCase()}Kg`],
    benefit: MATERIAL_BENEFIT_TEXT[label],
  }))

  const equivalencies = {
    kmAvoided: totals.netCarbonAbatedKgCO2e > 0 ? totals.netCarbonAbatedKgCO2e * KM_PER_KG_CO2E : 0,
    olympicPools: totals.waterSavedLiters / EQUIVALENCY.literesPerOlympicPool,
    householdYears: totals.energySavedKwh / EQUIVALENCY.kwhPerHouseholdYear,
    carWeights: totals.landfillAvertedKg / EQUIVALENCY.kgPerAverageCar,
  }

  const now = new Date()

  return {
    report: {
      id: `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(now.getTime() % 1e5)}`,
      title: toText(form.title, 'Carbon Abatement Report'),
      generatedAt: now.toISOString(),
      templateVersion: 'temporary-v1',
    },
    client: {
      name: toText(form.clientName),
      addressLine1: toText(form.clientAddressLine1, ''),
      addressLine2: toText(form.clientAddressLine2, ''),
      cityStateZipCountry: toText(form.clientCityStateZipCountry, ''),
      combinedAddress: combineAddress(form),
    },
    collectionDateRange: toText(form.collectionDateRange, ''),
    reportIssueDate: form.reportIssueDate || null,
    reportIssueDateLabel: formatDate(form.reportIssueDate),
    rows,
    totals,
    recycledMaterials,
    equivalencies,
  }
}
