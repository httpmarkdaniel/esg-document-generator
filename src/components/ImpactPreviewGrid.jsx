import { formatKg, formatUnit } from '../lib/format.js'

/**
 * Shared "Environmental Impact Preview" tile grid, used by both the
 * certificate and report generators so the two flows read consistently.
 */
export function ImpactPreviewGrid({ netWeightKg, carbonAbatedKgCO2e, waterSavedLiters, energySavedKwh, landfillAvertedKg }) {
  const tiles = [
    { label: 'Net Weight', value: formatKg(netWeightKg) },
    { label: 'Carbon Abated', value: formatUnit(carbonAbatedKgCO2e, 'kg CO2e') },
    { label: 'Water Saved', value: formatUnit(waterSavedLiters, 'L', 0) },
    { label: 'Energy Saved', value: formatUnit(energySavedKwh, 'kWh') },
    { label: 'Landfill Averted', value: formatKg(landfillAvertedKg) },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">{tile.label}</div>
          <div className="mt-0.5 text-lg font-semibold text-emerald-900">{tile.value}</div>
        </div>
      ))}
    </div>
  )
}
