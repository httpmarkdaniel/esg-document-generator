// Calculator form defaults + validation. Mirrors the pattern used by
// certificateData.js / reportData.js: this file owns the raw form shape,
// calculatorEngine.js owns the math.

import { toNumber, toText } from '../lib/format.js'
import { splitTotalPercent } from './calculatorEngine.js'

export function emptyCalculatorForm() {
  return {
    description: '',
    grossKg: '',
    tareKg: '',
    quantity: '',
    split: { metal: '', plastic: '', glass: '', electronics: '' },
  }
}

/** Validate a calculator form. Returns a map of field -> error message. */
export function validateCalculatorForm(form) {
  const errors = {}
  const gross = toNumber(form.grossKg)
  const tare = toNumber(form.tareKg)

  if (!toText(form.grossKg, '').trim() || gross <= 0) errors.grossKg = 'Enter the item weight in kilos.'
  if (tare > gross) errors.tareKg = 'Cage/pallet weight cannot exceed the gross weight.'

  const splitTotal = splitTotalPercent(form.split)
  if (Math.abs(splitTotal - 100) > 0.01) {
    errors.split = `The four percentages must total 100% (currently ${splitTotal.toFixed(1)}%).`
  }

  return errors
}
