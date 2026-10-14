import { useEffect, useMemo, useState } from 'react'
import { Card, PrimaryButton, GhostButton, Banner } from './Card.jsx'
import { FormField, TextInput } from './FormField.jsx'
import { RrPreviewEditor } from './RrPreviewEditor.jsx'
import { getRrNumbers, getRrSummary } from '../rrData/rrClient.js'
import { buildRrDocumentData, emptyRrDocumentData, rrTotals, EMPTY_ITEM } from '../receivingReport/rrReportData.js'
import { withoutRrDataOverrides } from '../receivingReport/rrReportText.js'
import { generateRrPdf } from '../receivingReport/generateRrPdf.js'
import { downloadBlob } from '../lib/download.js'

const ITEM_FIELDS = [
  { field: 'description', label: 'Description', className: 'min-w-[14rem]' },
  { field: 'kilos', label: 'Kilos', numeric: true },
  { field: 'palletWeight', label: 'Less: cage / pallets', numeric: true },
  { field: 'netWeight', label: 'Net weight', numeric: true },
  { field: 'qty', label: 'Qty', numeric: true },
  { field: 'uom', label: 'UOM' },
  { field: 'category', label: 'Category' },
  { field: 'remarks', label: 'Remarks', className: 'min-w-[9rem]' },
]

const cellInput =
  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-gray-900 outline-none transition hover:border-gray-200 focus:border-brand-green focus:bg-white'

/**
 * Receiving Report tab: type (or pick) an RR number and the whole Incoming
 * Receiving Report fills itself from the RR Google Sheet — header, trucking
 * details, every line item, totals and receiving notes. Everything stays
 * editable: line items in the table below, any other text right on the page.
 */
export function ReceivingReportGenerator() {
  const [rrNumbers, setRrNumbers] = useState([])
  const [listError, setListError] = useState(null)
  const [query, setQuery] = useState('')
  const [loadingRr, setLoadingRr] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [loadedRef, setLoadedRef] = useState('')

  const [doc, setDoc] = useState(emptyRrDocumentData)
  const [originalItems, setOriginalItems] = useState([])
  const [textOverrides, setTextOverrides] = useState({})
  const [placedImages, setPlacedImages] = useState([])
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  useEffect(() => {
    getRrNumbers()
      .then(setRrNumbers)
      .catch((err) => setListError(err.message))
  }, [])

  const known = useMemo(() => new Map(rrNumbers.map((n) => [n.toUpperCase(), n])), [rrNumbers])
  const typedMatch = known.get(query.trim().toUpperCase())

  // Typing a complete, existing RR number loads it straight away.
  useEffect(() => {
    if (typedMatch && typedMatch !== loadedRef) loadRr(typedMatch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedMatch])

  async function loadRr(referenceNo) {
    setLoadingRr(true)
    setLoadError(null)
    try {
      const summary = await getRrSummary(referenceNo)
      if (!summary) throw new Error(`No rows found for ${referenceNo}.`)
      const next = buildRrDocumentData(summary)
      setDoc(next)
      setOriginalItems(next.items)
      setTextOverrides((prev) => withoutRrDataOverrides(prev))
      setPlacedImages([])
      setLoadedRef(referenceNo)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoadingRr(false)
    }
  }

  function changeItem(index, field, value) {
    setDoc((prev) => ({ ...prev, items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }))
  }
  function addItem() {
    setDoc((prev) => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }))
  }
  function removeItem(index) {
    setDoc((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
    setOriginalItems((prev) => prev.filter((_, i) => i !== index))
  }
  function startBlank() {
    setDoc(emptyRrDocumentData())
    setOriginalItems([])
    setTextOverrides((prev) => withoutRrDataOverrides(prev))
    setPlacedImages([])
    setLoadedRef('')
    setQuery('')
  }

  async function handleDownload() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const { blob, filename } = await generateRrPdf({ ...doc, textOverrides, placedImages })
      downloadBlob(blob, filename)
    } catch (err) {
      console.error(err)
      setGenerateError('Could not generate the PDF.')
    } finally {
      setGenerating(false)
    }
  }

  const totals = rrTotals(doc.items)

  return (
    <div className="flex flex-col gap-6">
      <Card title="Receiving Report" subtitle="Type an RR number (e.g. S19029) — the report fills itself from the Receiving Reports Google Sheet.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="sm:w-72">
            <FormField
              label="RR Number"
              hint={listError ? undefined : rrNumbers.length ? `${rrNumbers.length.toLocaleString()} RRs in the sheet` : 'Loading RR numbers…'}
              error={listError}
            >
              <TextInput
                list="rr-number-options"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && typedMatch) loadRr(typedMatch)
                }}
                placeholder="S19029"
                autoComplete="off"
              />
              <datalist id="rr-number-options">
                {rrNumbers.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </FormField>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-[2px]">
            {loadingRr && <span className="text-xs text-gray-500">Loading {query.trim()}…</span>}
            {!loadingRr && loadedRef && (
              <span className="rounded-lg bg-brand-green-light px-2.5 py-1 text-xs font-medium text-brand-green-dark">
                Loaded {loadedRef} · {doc.header.accountName || 'no account name'} · {doc.items.length} item(s)
              </span>
            )}
            {!loadingRr && query.trim() && !typedMatch && rrNumbers.length > 0 && (
              <span className="text-xs text-gray-400">No RR {query.trim()} in the sheet yet</span>
            )}
            <GhostButton type="button" onClick={startBlank}>
              Start blank
            </GhostButton>
          </div>
        </div>
        {loadError && (
          <div className="mt-3">
            <Banner tone="error">{loadError}</Banner>
          </div>
        )}
      </Card>

      <Card title="Line Items" subtitle="One row per item on the report. Edit any cell; totals update on the PDF.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-1.5 py-1.5 font-medium">#</th>
                {ITEM_FIELDS.map((c) => (
                  <th key={c.field} className={`px-1.5 py-1.5 font-medium ${c.numeric ? 'text-right' : ''}`}>
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-1.5 text-gray-400">{i + 1}</td>
                  {ITEM_FIELDS.map((c) => (
                    <td key={c.field} className={c.className || 'w-20'}>
                      <input
                        value={item[c.field]}
                        onChange={(e) => changeItem(i, c.field, e.target.value)}
                        inputMode={c.numeric ? 'decimal' : undefined}
                        className={`${cellInput} ${c.numeric ? 'text-right' : ''}`}
                      />
                    </td>
                  ))}
                  <td className="px-1">
                    <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-600" aria-label={`Remove item ${i + 1}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {doc.items.length === 0 && (
                <tr>
                  <td colSpan={ITEM_FIELDS.length + 2} className="py-4 text-center text-gray-400">
                    No items yet — load an RR or add a row.
                  </td>
                </tr>
              )}
            </tbody>
            {doc.items.length > 0 && (
              <tfoot>
                <tr className="font-semibold text-gray-700">
                  <td />
                  <td className="px-1.5 py-1.5">Total</td>
                  <td className="px-1.5 text-right">{totals.kilos}</td>
                  <td className="px-1.5 text-right">{totals.palletWeight}</td>
                  <td className="px-1.5 text-right text-red-600">{totals.netWeight}</td>
                  <td className="px-1.5 text-right">{totals.qty}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="mt-3">
          <GhostButton type="button" onClick={addItem}>
            + Add row
          </GhostButton>
        </div>
      </Card>

      <RrPreviewEditor
        data={doc}
        overrides={textOverrides}
        onOverridesChange={setTextOverrides}
        images={placedImages}
        onImagesChange={setPlacedImages}
        originalItems={originalItems}
        onItemChange={changeItem}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-gray-500">Downloads as a PDF named like the original, e.g. “S19029 - ACCENTURE INC. (LHEPACC31212_ACNTQ00107056).pdf”.</span>
            <PrimaryButton type="button" onClick={handleDownload} loading={generating} className="shrink-0 sm:w-64">
              Download Receiving Report PDF
            </PrimaryButton>
          </div>
        }
      />
      {generateError && <Banner tone="error">{generateError}</Banner>}
    </div>
  )
}
