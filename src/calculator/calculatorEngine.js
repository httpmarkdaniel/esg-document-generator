// ESG Impact Calculator engine — reverse-engineered from the real
// "ESG Impact Calculator.html" (its breakdown table and assumptions panel
// spell out the exact formulas and factors, even though its JS bundle
// wasn't included in the saved page).
//
// Source: NEO - Abatement Report.xlsx, "S19529-S19530", methodology
// sections 4.5-4.7 (cells B220:E251).
//
// This is the SINGLE SOURCE OF TRUTH for ESG math in this app. The
// certificate and report modules must never re-derive these numbers from
// scratch — they either take calculator output directly, or sum rows that
// originated from it.

import { toNumber } from '../lib/format.js'

export const MATERIAL_KEYS = ['metal', 'plastic', 'glass', 'electronics']

export const MATERIAL_LABELS = {
  metal: 'Metal',
  plastic: 'Plastic',
  glass: 'Glass',
  electronics: 'Electronics',
}

// Primary (virgin-material) emission factors, kg CO2e per kg of material.
// Recycling factors are always 20% of the primary factor (per the
// calculator's stated assumptions) — net abatement is 80% of primary
// emissions with this factor set.
export const PRIMARY_FACTORS = {
  metal: 10.5,
  plastic: 3.0,
  glass: 1.0,
  electronics: 9.0,
}
export const RECYCLING_FACTOR_RATE = 0.2

export const WATER_LITERS_PER_KG = 200
export const ENERGY_KWH_PER_KG = 30
export const LANDFILL_DIVERSION_RATE = 1 // 100% of net weight is treated as diverted

/** Sum of the four material split percentages (should equal 100). */
export function splitTotalPercent(split) {
  return MATERIAL_KEYS.reduce((sum, key) => sum + toNumber(split?.[key]), 0)
}

/**
 * Run the calculator on a raw input. Every intermediate value is kept
 * unrounded (matching "Calculations use unrounded values" in the source
 * calculator) — only display layers round.
 *
 * @param {{ grossKg: number|string, tareKg: number|string, split: Record<'metal'|'plastic'|'glass'|'electronics', number|string> }} input
 */
export function calculateImpact({ grossKg, tareKg, split }) {
  const gross = toNumber(grossKg)
  const tare = toNumber(tareKg)
  const netWeightKg = gross - tare

  const materials = {}
  let totalCarbonFootprintKgCO2e = 0
  let recycledEmissionsKgCO2e = 0

  for (const key of MATERIAL_KEYS) {
    const splitPercent = toNumber(split?.[key])
    const weightKg = netWeightKg * (splitPercent / 100)
    const primaryFactor = PRIMARY_FACTORS[key]
    const recyclingFactor = primaryFactor * RECYCLING_FACTOR_RATE
    const primaryEmissionsKgCO2e = weightKg * primaryFactor
    const recyclingEmissionsKgCO2e = weightKg * recyclingFactor
    const netAbatedKgCO2e = primaryEmissionsKgCO2e - recyclingEmissionsKgCO2e

    materials[key] = {
      splitPercent,
      weightKg,
      primaryFactor,
      recyclingFactor,
      primaryEmissionsKgCO2e,
      recyclingEmissionsKgCO2e,
      netAbatedKgCO2e,
    }
    totalCarbonFootprintKgCO2e += primaryEmissionsKgCO2e
    recycledEmissionsKgCO2e += recyclingEmissionsKgCO2e
  }

  const netCarbonAbatedKgCO2e = totalCarbonFootprintKgCO2e - recycledEmissionsKgCO2e
  const waterSavedLiters = netWeightKg * WATER_LITERS_PER_KG
  const energySavedKwh = netWeightKg * ENERGY_KWH_PER_KG
  const landfillAvertedKg = netWeightKg * LANDFILL_DIVERSION_RATE

  return {
    netWeightKg,
    materials,
    totalCarbonFootprintKgCO2e,
    recycledEmissionsKgCO2e,
    netCarbonAbatedKgCO2e,
    waterSavedLiters,
    energySavedKwh,
    landfillAvertedKg,
  }
}

/**
 * Carbon footprint / recycled emissions from a KG-based material breakdown
 * (not percentages) — used wherever material weights are already known
 * directly (certificate/report forms) rather than derived from a % split.
 * Accepts the `{ metalKg, plasticKg, glassKg, electronicsKg }` shape used
 * throughout certificateData.js / reportData.js.
 */
export function calculateCarbonFromMaterialWeights(materials) {
  let totalCarbonFootprintKgCO2e = 0
  let recycledEmissionsKgCO2e = 0

  for (const key of MATERIAL_KEYS) {
    const weightKg = toNumber(materials?.[`${key}Kg`])
    const primaryFactor = PRIMARY_FACTORS[key]
    const recyclingFactor = primaryFactor * RECYCLING_FACTOR_RATE
    totalCarbonFootprintKgCO2e += weightKg * primaryFactor
    recycledEmissionsKgCO2e += weightKg * recyclingFactor
  }

  return {
    totalCarbonFootprintKgCO2e,
    recycledEmissionsKgCO2e,
    netCarbonAbatedKgCO2e: totalCarbonFootprintKgCO2e - recycledEmissionsKgCO2e,
  }
}

/**
 * Water/energy/landfill savings from net weight alone — these do NOT
 * depend on material composition, so they can be computed as soon as a net
 * weight is known (e.g. straight from an RR's weight, before any material
 * breakdown has been entered).
 */
export function calculateSavingsFromNetWeight(netWeightKg) {
  const netWeight = toNumber(netWeightKg)
  return {
    waterSavedLiters: netWeight * WATER_LITERS_PER_KG,
    energySavedKwh: netWeight * ENERGY_KWH_PER_KG,
    landfillAvertedKg: netWeight * LANDFILL_DIVERSION_RATE,
  }
}
