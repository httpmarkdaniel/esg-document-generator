import { useEffect, useMemo, useState } from 'react'
import { PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput } from './FormField.jsx'
import { formatKg } from '../lib/format.js'
import { getAllRrSummaries } from '../rrData/rrClient.js'

// Rendering thousands of checkbox rows at once gets sluggish; the date range
// and search narrow the list well before this cap matters.
const MAX_VISIBLE_ROWS = 300

/**
 * Pick any number of RRs from the RR Google Sheet. The received-date range
 * and search box only narrow the list — ticked RRs stay selected even when
 * they fall outside the current filter (they show as chips). Nothing happens
 * until the apply button is pressed, so ticking boxes never overwrites the
 * form mid-selection.
 */
export function RrMultiPicker({ applyLabel, onApply, clearOnApply = false }) {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => new Set())

  useEffect(() => {
    getAllRrSummaries()
      .then(setAll)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Some RRs have rows received on different dates — an RR matches the
    // range when any of its rows does (the whole RR is then selectable).
    const inRange = (d) => d && (!rangeStart || d >= rangeStart) && (!rangeEnd || d <= rangeEnd)
    return all.filter((s) => {
      if ((rangeStart || rangeEnd) && !s.items.some((i) => inRange(i.receivedDateIso))) return false
      if (q && !s.referenceNo.toLowerCase().includes(q) && !(s.accountName || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [all, rangeStart, rangeEnd, search])

  const visible = filtered.slice(0, MAX_VISIBLE_ROWS)
  const selectedSummaries = useMemo(() => all.filter((s) => selected.has(s.referenceNo)), [all, selected])
  const selectedWeight = selectedSummaries.reduce((sum, s) => sum + s.totalNetWeight, 0)
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.referenceNo))

  function toggle(referenceNo) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(referenceNo)) next.delete(referenceNo)
      else next.add(referenceNo)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const s of filtered) {
        if (allFilteredSelected) next.delete(s.referenceNo)
        else next.add(s.referenceNo)
      }
      return next
    })
  }

  function handleApply() {
    onApply(selectedSummaries)
    if (clearOnApply) setSelected(new Set())
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Received From">
          <TextInput type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
        </FormField>
        <FormField label="Received To">
          <TextInput type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
        </FormField>
        <FormField label="Search">
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="RR number or account" />
        </FormField>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {selectedSummaries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedSummaries.map((s) => (
            <button
              key={s.referenceNo}
              type="button"
              onClick={() => toggle(s.referenceNo)}
              className="inline-flex items-center gap-1 rounded-full border border-brand-green/20 bg-brand-green-light px-2.5 py-1 text-xs font-medium text-brand-green-dark hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              title="Remove from selection"
            >
              {s.referenceNo} <span aria-hidden>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-gray-200">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <span>
            {loading ? 'Loading RRs…' : `${filtered.length} RR(s) match`}
            {filtered.length > MAX_VISIBLE_ROWS && ` — showing the first ${MAX_VISIBLE_ROWS}, narrow the dates or search to see the rest`}
          </span>
          {filtered.length > 0 && (
            <button type="button" onClick={toggleAllFiltered} className="shrink-0 font-medium text-brand-green hover:underline">
              {allFilteredSelected ? 'Unselect all matching' : `Select all ${filtered.length} matching`}
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {visible.map((s) => (
            <label
              key={s.referenceNo}
              className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-3 py-2 text-sm last:border-0 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={selected.has(s.referenceNo)}
                onChange={() => toggle(s.referenceNo)}
                className="h-4 w-4 shrink-0 accent-brand-green"
              />
              <span className="w-24 shrink-0 font-medium text-gray-800">{s.referenceNo}</span>
              <span className="min-w-0 flex-1 truncate text-gray-600">{s.accountName || '—'}</span>
              <span className="hidden shrink-0 text-xs text-gray-400 sm:inline">{s.receivedDate || '—'}</span>
              <span className="w-24 shrink-0 text-right text-xs text-gray-500">{formatKg(s.totalNetWeight)}</span>
            </label>
          ))}
          {!loading && !filtered.length && <p className="px-3 py-4 text-center text-xs text-gray-400">No RRs match these filters.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-gray-500">
          {selectedSummaries.length} selected · {formatKg(selectedWeight)} net weight
          {selectedSummaries.length > 0 && (
            <>
              {' · '}
              <GhostButton type="button" onClick={() => setSelected(new Set())} className="ml-1 py-0.5">
                Clear
              </GhostButton>
            </>
          )}
        </span>
        <PrimaryButton type="button" onClick={handleApply} disabled={!selectedSummaries.length}>
          {applyLabel(selectedSummaries.length)}
        </PrimaryButton>
      </div>
    </div>
  )
}
