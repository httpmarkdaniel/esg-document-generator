import { useMemo, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput, inputErrorClass } from './FormField.jsx'
import { emptyCalculatorForm, validateCalculatorForm } from '../calculator/calculatorForm.js'
import { calculateImpact, splitTotalPercent, MATERIAL_KEYS, MATERIAL_LABELS } from '../calculator/calculatorEngine.js'
import { formatKg, formatNumber, formatUnit, toNumber } from '../lib/format.js'

const SWATCH = {
  metal: 'bg-slate-400',
  plastic: 'bg-sky-400',
  glass: 'bg-emerald-400',
  electronics: 'bg-amber-400',
}

/**
 * The ESG Impact Calculator — the single source of truth for carbon/water/
 * energy/landfill math in this app. `onUseInCertificate` / `onAddToReport`
 * hand the computed result (plus the input, for labeling) up to the page so
 * the other tabs never have to re-derive these numbers themselves.
 */
export function CalculatorPanel({ onUseInCertificate, onAddToReport }) {
  const [form, setForm] = useState(emptyCalculatorForm())
  const [touched, setTouched] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(true)

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function setSplit(key, value) {
    setForm((f) => ({ ...f, split: { ...f.split, [key]: value } }))
  }

  const errors = useMemo(() => validateCalculatorForm(form), [form])
  const isValid = Object.keys(errors).length === 0
  const splitTotal = splitTotalPercent(form.split)

  const result = useMemo(
    () => calculateImpact({ grossKg: form.grossKg, tareKg: form.tareKg, split: form.split }),
    [form.grossKg, form.tareKg, form.split],
  )

  function loadExample() {
    setForm({
      description: 'Example equipment',
      grossKg: '86.6',
      tareKg: '0',
      quantity: '10',
      split: { metal: '50', plastic: '20', glass: '0', electronics: '30' },
    })
    setTouched(true)
  }

  function clearForm() {
    setForm(emptyCalculatorForm())
    setTouched(false)
  }

  function handleUse(action) {
    setTouched(true)
    if (!isValid) return
    action({ input: form, result, id: `${Date.now()}` })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Your Inputs">
        <div className="grid gap-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <FormField label="Item description" hint="Optional">
                <TextInput value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="e.g. Monitors" />
              </FormField>
            </div>
            <div className="flex gap-2 pb-0.5">
              <GhostButton type="button" onClick={loadExample}>
                Load example
              </GhostButton>
              <GhostButton type="button" onClick={clearForm}>
                Clear
              </GhostButton>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">01 &nbsp;Weight &amp; quantity</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Kilos (gross, kg)" error={touched ? errors.grossKg : undefined}>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.grossKg}
                  onChange={(e) => setField('grossKg', e.target.value)}
                  className={inputErrorClass(touched && errors.grossKg)}
                />
              </FormField>
              <FormField label="Less: cage / pallets (kg)" error={touched ? errors.tareKg : undefined}>
                <TextInput
                  type="number"
                  inputMode="decimal"
                  value={form.tareKg}
                  onChange={(e) => setField('tareKg', e.target.value)}
                  className={inputErrorClass(touched && errors.tareKg)}
                />
              </FormField>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className="text-gray-500">
                Net weight <span className="text-xs text-gray-400">({formatNumber(form.grossKg || 0, 1)} − {formatNumber(form.tareKg || 0, 1)})</span>
              </span>
              <span className="font-semibold text-gray-900">{formatKg(result.netWeightKg)}</span>
            </div>
            <FormField label="Quantity" hint="Optional — for tracking only, not used in the weight math" className="mt-3">
              <TextInput type="number" inputMode="numeric" value={form.quantity} onChange={(e) => setField('quantity', e.target.value)} className="w-32" />
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">02 &nbsp;Material split</span>
              <span className={`text-xs font-semibold ${Math.abs(splitTotal - 100) < 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatNumber(splitTotal, 1)}% total
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MATERIAL_KEYS.map((key) => (
                <FormField key={key} label={MATERIAL_LABELS[key]}>
                  <TextInput type="number" inputMode="decimal" min="0" max="100" value={form.split[key]} onChange={(e) => setSplit(key, e.target.value)} />
                </FormField>
              ))}
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100">
              {MATERIAL_KEYS.map((key) => (
                <span key={key} className={SWATCH[key]} style={{ width: `${Math.max(toNumber(form.split[key]), 0)}%` }} />
              ))}
            </div>
            {touched && errors.split && <p className="mt-1.5 text-xs text-red-600">{errors.split}</p>}
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-5">
        <Card title="Environmental Impact" subtitle="Per item description — results update as you type.">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">Net Carbon Abated</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-emerald-900">{formatNumber(result.netCarbonAbatedKgCO2e)}</span>
              <span className="text-sm text-emerald-700">kg CO2e</span>
            </div>
            <p className="mt-1 text-xs text-emerald-700/70">Estimated primary-material emissions minus recycling emissions.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-emerald-100 pt-3">
              <div>
                <div className="text-xs text-emerald-700/70">Total carbon footprint</div>
                <div className="font-semibold text-emerald-900">{formatUnit(result.totalCarbonFootprintKgCO2e, 'kg CO2e')}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-700/70">Total recycled emissions</div>
                <div className="font-semibold text-emerald-900">{formatUnit(result.recycledEmissionsKgCO2e, 'kg CO2e')}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Water saved</div>
              <div className="text-lg font-semibold text-gray-900">{formatNumber(result.waterSavedLiters, 0)}</div>
              <div className="text-xs text-gray-400">liters</div>
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Energy saved</div>
              <div className="text-lg font-semibold text-gray-900">{formatNumber(result.energySavedKwh)}</div>
              <div className="text-xs text-gray-400">kWh</div>
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">Landfill averted</div>
              <div className="text-lg font-semibold text-gray-900">{formatNumber(result.landfillAvertedKg)}</div>
              <div className="text-xs text-gray-400">kg</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-3">
            {touched && !isValid && <Banner tone="error">Fix the highlighted fields above before using this calculation.</Banner>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrimaryButton type="button" onClick={() => handleUse(onUseInCertificate)} className="flex-1">
                Use in Certificate →
              </PrimaryButton>
              <PrimaryButton type="button" onClick={() => handleUse(onAddToReport)} className="flex-1 !bg-slate-700 hover:!bg-slate-800">
                Add to Report →
              </PrimaryButton>
            </div>
            <p className="text-xs text-gray-400">
              Sends this calculation's carbon, water, energy, landfill and material-weight results directly into the
              document forms — no retyping.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Calculation Breakdown"
        subtitle="Material kg = net weight × material %. Each emissions column is material kg × its factor."
        className="lg:col-span-2"
      >
        <button type="button" onClick={() => setShowBreakdown((s) => !s)} className="mb-3 text-xs font-medium text-emerald-700 hover:underline">
          {showBreakdown ? 'Hide' : 'Show'} breakdown table
        </button>
        {showBreakdown && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-2">Material</th>
                  <th className="pb-2 pr-2 text-right">Split</th>
                  <th className="pb-2 pr-2 text-right">Weight (kg)</th>
                  <th className="pb-2 pr-2 text-right">Primary factor</th>
                  <th className="pb-2 pr-2 text-right">Primary emissions</th>
                  <th className="pb-2 pr-2 text-right">Recycling factor</th>
                  <th className="pb-2 pr-2 text-right">Recycling emissions</th>
                  <th className="pb-2 text-right">Net abated</th>
                </tr>
              </thead>
              <tbody>
                {MATERIAL_KEYS.map((key) => {
                  const m = result.materials[key]
                  return (
                    <tr key={key} className="border-t border-gray-50">
                      <td className="py-1.5 pr-2">
                        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${SWATCH[key]}`} />
                        {MATERIAL_LABELS[key]}
                      </td>
                      <td className="py-1.5 pr-2 text-right">{formatNumber(m.splitPercent, 0)}%</td>
                      <td className="py-1.5 pr-2 text-right">{formatNumber(m.weightKg)}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-400">{formatNumber(m.primaryFactor, 1)}</td>
                      <td className="py-1.5 pr-2 text-right">{formatNumber(m.primaryEmissionsKgCO2e)}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-400">{formatNumber(m.recyclingFactor, 2)}</td>
                      <td className="py-1.5 pr-2 text-right">{formatNumber(m.recyclingEmissionsKgCO2e)}</td>
                      <td className="py-1.5 text-right font-semibold text-emerald-700">{formatNumber(m.netAbatedKgCO2e)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-1.5 pr-2">Total</td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(splitTotal, 0)}%</td>
                  <td className="py-1.5 pr-2 text-right">{formatKg(result.netWeightKg)}</td>
                  <td className="py-1.5 pr-2 text-right text-gray-400">—</td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(result.totalCarbonFootprintKgCO2e)}</td>
                  <td className="py-1.5 pr-2 text-right text-gray-400">—</td>
                  <td className="py-1.5 pr-2 text-right">{formatNumber(result.recycledEmissionsKgCO2e)}</td>
                  <td className="py-1.5 text-right text-emerald-700">{formatNumber(result.netCarbonAbatedKgCO2e)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              Primary factors: metal 10.5, plastic 3.0, glass 1.0, electronics 9.0 kg CO2e/kg. Recycling factors are
              20% of primary. Water and energy use fixed rates of 200 L/kg and 30 kWh/kg of net weight; landfill
              averted assumes 100% diversion of net weight. Source: NEO – Abatement Report.xlsx, methodology
              sections 4.5–4.7.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
