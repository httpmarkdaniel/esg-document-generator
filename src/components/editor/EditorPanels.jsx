import { useMemo, useRef } from 'react'
import { GhostButton, Banner } from '../Card.jsx'
import { TextInput, TextArea } from '../FormField.jsx'

const sectionTitle = 'mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green'

/** "Images" section: add images by file picker, list them, select/remove. */
export function ImagesSection({ images, selectedId, onSelect, onRemove, onAddFiles, error, pageLabel }) {
  const fileInputRef = useRef(null)
  return (
    <div className="mb-4">
      <div className={sectionTitle}>Images</div>
      <p className="mb-2 text-xs text-gray-500">Drop an image onto the page, or add one here. Drag it to move, drag its corner to resize.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <GhostButton type="button" onClick={() => fileInputRef.current?.click()}>
        + Add image
      </GhostButton>
      {error && (
        <div className="mt-2">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
      {images.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {images.map((img) => (
            <li
              key={img.id}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${img.id === selectedId ? 'border-brand-green bg-brand-green-light' : 'border-gray-200'}`}
            >
              <button type="button" onClick={() => onSelect(img.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <img src={img.dataUrl} alt="" className="h-6 w-10 shrink-0 rounded bg-gray-300 object-contain p-0.5" />
                <span className="truncate text-gray-700">{img.name}</span>
                {pageLabel && <span className="shrink-0 text-[10px] text-gray-400">{pageLabel(img)}</span>}
              </button>
              <button type="button" onClick={() => onRemove(img.id)} className="shrink-0 text-gray-400 hover:text-red-600" aria-label={`Remove ${img.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * "Built-in images" section: on/off switches for the document's fixed images
 * (`toggles`), and the removed/moved logos (`logos`) with Restore.
 */
export function BuiltInSection({ toggles, logos, hidden, images, onHide, onRestore }) {
  const movedIds = new Set(images.map((img) => img.sourceId).filter(Boolean))
  const changedLogos = logos.filter((l) => hidden.has(l.id))
  return (
    <div className="mb-4">
      <div className={sectionTitle}>Built-in images</div>
      <p className="mb-2 text-xs text-gray-500">
        On the page, click a logo to move or resize it, or click its ✕ to remove it. Changed logos are listed here to restore.
      </p>
      {toggles.map(({ id, label }) => (
        <label key={id} className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={!hidden.has(id)}
            onChange={(e) => (e.target.checked ? onRestore([id]) : onHide(id))}
            className="h-4 w-4 accent-brand-green"
          />
          {label}
          {movedIds.has(id) && <span className="text-gray-400">(moved/resized)</span>}
        </label>
      ))}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>
            Compliance logos: {logos.length - changedLogos.length} of {logos.length} shown
          </span>
          {changedLogos.length > 0 && (
            <button type="button" onClick={() => onRestore(changedLogos.map((l) => l.id))} className="font-medium text-brand-green hover:underline">
              Restore all
            </button>
          )}
        </div>
        {changedLogos.length > 0 && (
          <ul className="flex flex-col gap-1">
            {changedLogos.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500">
                <span className="truncate">
                  {l.name} <span className="text-gray-400">{movedIds.has(l.id) ? '(moved/resized)' : '(removed)'}</span>
                </span>
                <button type="button" onClick={() => onRestore([l.id])} className="shrink-0 font-medium text-brand-green hover:underline">
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * "Text" section: every editable text field, grouped by section. Typing
 * overrides the auto text, clearing hides it, Reset restores it. The
 * "Signatories" section also gets the e-signature switch.
 */
export function TextFieldsSection({ fields, overrides, onTextChange, onReset, onShowSignatures }) {
  const sections = useMemo(() => {
    const bySection = new Map()
    for (const f of fields) {
      if (!bySection.has(f.section)) bySection.set(f.section, [])
      bySection.get(f.section).push(f)
    }
    return [...bySection.entries()]
  }, [fields])

  return (
    <>
      <div className={sectionTitle}>Text</div>
      <p className="mb-3 text-xs text-gray-500">
        Change any text here. Clear a field to remove that text. Figures and client details reset automatically when new RR or calculator data is loaded.
      </p>
      {sections.map(([section, sectionFields]) => (
        <div key={section} className="mb-4 last:mb-0">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{section}</div>
          {section === 'Signatories' && (
            <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={!overrides.hideSignatures}
                onChange={(e) => onShowSignatures(e.target.checked)}
                className="h-4 w-4 accent-brand-green"
              />
              Show e-signatures
              <span className="text-[11px] text-gray-400">(only above each person&apos;s own name)</span>
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
                      <button type="button" onClick={() => onReset(f.key)} className="text-[11px] font-medium text-brand-green hover:underline">
                        Reset
                      </button>
                    )}
                  </div>
                  <Input
                    value={value}
                    onChange={(e) => onTextChange(f.key, e.target.value, f.value)}
                    rows={Input === TextArea ? Math.min(Math.max(value.split('\n').length, 2), 5) : undefined}
                    className="text-xs"
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
