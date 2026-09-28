import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, GhostButton } from './Card.jsx'
import { TextInput, TextArea } from './FormField.jsx'
import { generateCertificatePdf } from '../certificate/generateCertificatePdf.js'
import { certificateTextFields } from '../certificate/certificateText.js'

// How long typing has to pause before the PDF preview re-renders.
const PREVIEW_DEBOUNCE_MS = 350

/**
 * The real certificate PDF (the exact file "Generate" downloads), re-rendered
 * live as the form changes, plus an optional editor for every piece of text
 * printed on it. Edits are overrides on top of the auto-generated text:
 * typing replaces a line, clearing it hides the line, Reset restores the
 * auto text.
 */
export function CertificatePreviewEditor({ data, overrides, onOverridesChange, actions }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [editing, setEditing] = useState(false)
  const urlRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setRendering(true)
      try {
        const { blob } = await generateCertificatePdf(data)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setPdfUrl(url)
        setRenderError(null)
      } catch (err) {
        console.error(err)
        if (!cancelled) setRenderError('Could not render the preview.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    }, PREVIEW_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [data])

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), [])

  // Defaults come from the data WITHOUT overrides, so the editor can show
  // what Reset goes back to.
  const fields = useMemo(() => certificateTextFields({ ...data, textOverrides: {} }), [data])
  const sections = useMemo(() => {
    const bySection = new Map()
    for (const f of fields) {
      if (!bySection.has(f.section)) bySection.set(f.section, [])
      bySection.get(f.section).push(f)
    }
    return [...bySection.entries()]
  }, [fields])
  const editedCount = fields.filter((f) => f.key in overrides).length + (overrides.hideSignatures ? 1 : 0)

  function setText(key, value, defaultValue) {
    const next = { ...overrides }
    if (value === defaultValue) delete next[key]
    else next[key] = value
    onOverridesChange(next)
  }

  function setShowSignatures(show) {
    const next = { ...overrides }
    if (show) delete next.hideSignatures
    else next.hideSignatures = true
    onOverridesChange(next)
  }

  function reset(key) {
    const next = { ...overrides }
    delete next[key]
    onOverridesChange(next)
  }

  return (
    <Card title="Certificate Preview" subtitle="This is the exact PDF that gets generated — it updates as you change the form.">
      {actions && <div className="mb-4 border-b border-gray-100 pb-4">{actions}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {rendering ? 'Updating preview…' : renderError || 'Up to date'}
          {editedCount > 0 && <> · <strong className="text-amber-700">{editedCount} text edit(s) applied</strong></>}
        </span>
        <div className="flex gap-2">
          {editedCount > 0 && (
            <GhostButton type="button" onClick={() => onOverridesChange({})}>
              Reset all edits
            </GhostButton>
          )}
          <GhostButton
            type="button"
            onClick={() => setEditing((e) => !e)}
            className={editing ? 'border-brand-green bg-brand-green-light text-brand-green-dark' : ''}
          >
            {editing ? 'Done editing' : '✎ Edit certificate text'}
          </GhostButton>
        </div>
      </div>

      <div className={`grid gap-4 ${editing ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          {/* A4 landscape aspect ratio (297 × 210). */}
          <div className="relative w-full" style={{ aspectRatio: '297 / 210' }}>
            {pdfUrl ? (
              <iframe title="Certificate preview" src={`${pdfUrl}#toolbar=0&navpanes=0&view=Fit`} className="absolute inset-0 h-full w-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Rendering preview…</div>
            )}
          </div>
        </div>

        {editing && (
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 p-3 lg:max-h-none lg:h-0 lg:min-h-full">
            <p className="mb-3 text-xs text-gray-500">
              Change any text on the certificate. Clear a field to remove that text. Stat values and the recipient block reset automatically when new RR or
              calculator data is loaded.
            </p>
            {sections.map(([section, sectionFields]) => (
              <div key={section} className="mb-4 last:mb-0">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green">{section}</div>
                {section === 'Signatories' && (
                  <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={!overrides.hideSignatures}
                      onChange={(e) => setShowSignatures(e.target.checked)}
                      className="h-4 w-4 accent-brand-green"
                    />
                    Show e-signatures
                    <span className="text-[11px] text-gray-400">(only above each person's own name)</span>
                  </label>
                )}
                <div className="flex flex-col gap-2.5">
                  {sectionFields.map((f) => {
                    const edited = f.key in overrides
                    const value = edited ? overrides[f.key] : f.value
                    const Input = f.multiline || value.includes('\n') ? TextArea : TextInput
                    return (
                      <div key={f.key}>
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-gray-500">
                            {f.label}
                            {edited && <span className="ml-1.5 rounded bg-amber-100 px-1 py-px text-[10px] font-medium text-amber-800">{value === '' ? 'hidden' : 'edited'}</span>}
                          </span>
                          {edited && (
                            <button type="button" onClick={() => reset(f.key)} className="text-[11px] font-medium text-brand-green hover:underline">
                              Reset
                            </button>
                          )}
                        </div>
                        <Input
                          value={value}
                          onChange={(e) => setText(f.key, e.target.value, f.value)}
                          rows={Input === TextArea ? Math.min(Math.max(value.split('\n').length, 2), 5) : undefined}
                          className="text-xs"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
