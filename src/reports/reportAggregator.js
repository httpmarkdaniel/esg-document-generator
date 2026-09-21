// Aggregates a report form (manually entered transactions + materials) into
// the ESGReportData object the DOCX generator consumes. This is the only
// place that sums/derives values — the template layer only formats and
// lays them out.

import { toNumber, toText } from '../lib/format.js'

function sumBy(list, key) {
  return list.reduce((acc, item) => acc + toNumber(item[key]), 0)
}

/**
 * @param {ReturnType<import('./reportData.js').emptyReportForm>} form
 * @returns {import('./reportData.js').ESGReportData}
 */
export function buildEsgReportData(form) {
  const transactions = (form.transactions || [])
    .filter((t) => toText(t.reference, '').trim() || toText(t.description, '').trim())
    .map((t, i) => ({
      calculationId: toText(t.calculationId, `TXN-${i + 1}`),
      reference: toText(t.reference),
      date: t.date || null,
      description: toText(t.description),
      quantity: toNumber(t.quantity),
      netWeightKg: toNumber(t.netWeightKg),
      carbonAbatedKgCO2e: toNumber(t.carbonAbatedKgCO2e),
      waterSavedLiters: toNumber(t.waterSavedLiters),
      energySavedKwh: toNumber(t.energySavedKwh),
      landfillAvertedKg: toNumber(t.landfillAvertedKg),
    }))

  const materialsRaw = (form.materials || []).filter((m) => toText(m.material, '').trim())
  const totalMaterialWeight = sumBy(materialsRaw, 'weightKg')
  const materials = materialsRaw.map((m) => {
    const weightKg = toNumber(m.weightKg)
    return {
      material: toText(m.material),
      weightKg,
      percentage: totalMaterialWeight > 0 ? (weightKg / totalMaterialWeight) * 100 : 0,
    }
  })

  const summary = {
    transactionCount: transactions.length,
    totalNetWeightKg: sumBy(transactions, 'netWeightKg'),
    carbonAbatedKgCO2e: sumBy(transactions, 'carbonAbatedKgCO2e'),
    waterSavedLiters: sumBy(transactions, 'waterSavedLiters'),
    energySavedKwh: sumBy(transactions, 'energySavedKwh'),
    landfillAvertedKg: sumBy(transactions, 'landfillAvertedKg'),
  }

  // The transaction totals are the source of truth for net carbon abated.
  // primary/recycling emissions are an optional supplementary breakdown the
  // user can provide for context; they do not override the summed total.
  const primaryMaterialEmissionsKgCO2e = toNumber(form.primaryMaterialEmissionsKgCO2e)
  const recyclingEmissionsKgCO2e = toNumber(form.recyclingEmissionsKgCO2e)

  const assumptions = toText(form.assumptions, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const now = new Date()

  return {
    report: {
      id: `RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.floor(now.getTime() % 1e5)}`,
      title: toText(form.title, 'Environmental Impact Report'),
      periodStart: form.periodStart || null,
      periodEnd: form.periodEnd || null,
      generatedAt: now.toISOString(),
      templateVersion: 'temporary-v1',
    },
    organization: toText(form.organization, ''),
    filters: {
      client: toText(form.filters?.client, ''),
      vendor: toText(form.filters?.vendor, ''),
      project: toText(form.filters?.project, ''),
      auction: toText(form.filters?.auction, ''),
      branch: toText(form.filters?.branch, ''),
    },
    summary,
    carbon: {
      primaryMaterialEmissionsKgCO2e,
      recyclingEmissionsKgCO2e,
      netCarbonAbatedKgCO2e: summary.carbonAbatedKgCO2e,
    },
    materials,
    transactions,
    methodology: {
      version: toText(form.methodologyVersion, 'v1 (temporary)'),
      source: toText(form.methodologySource, 'Manually entered values'),
      assumptions: assumptions.length ? assumptions : ['No assumptions recorded.'],
    },
  }
}
