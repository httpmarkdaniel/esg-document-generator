import { useRef } from 'react'
import { GhostButton, Banner } from '../Card.jsx'
import { DESIGN_FONTS, isDataField } from '../../certificate/customDesign.js'

const sectionTitle = 'mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green'
const toHex = (rgb = [0, 0, 0]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/**
 * "Canva design" section of the certificate editor: upload/replace/remove a
 * design for the current certificate type, choose which fields to print on
 * it, and style the selected field. Positions are set by dragging on the page.
 */
export function DesignPanel({ design, fields, typeLabel, selectedKey, onSelect, onUpload, onRemove, onFieldChange, onResetField, onResetAll, uploading, error, labelOf }) {
  const inputRef = useRef(null)
  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,application/pdf"
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.[0]) onUpload(e.target.files[0])
        e.target.value = ''
      }}
    />
  )

  if (!design) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-sky-300 bg-sky-50/50 p-3">
        <div className={sectionTitle}>Canva design</div>
        <p className="mb-2 text-xs text-gray-600">
          Design the {typeLabel} in Canva (logos, colours, borders, fixed wording), export it, and upload it here. The app then prints the live data — recipient,
          certificate no., figures, dates, signatures — on top of your design, and you drag each field into place once.
        </p>
        <ul className="mb-2 list-disc pl-4 text-[11px] text-gray-500">
          <li>Canva size: A4 landscape (297 × 210 mm). Export as PNG or PDF.</li>
          <li>Leave the spots for the data empty in Canva.</li>
          <li>Starting point: generate this certificate as a PDF and import it into Canva.</li>
        </ul>
        {picker}
        <GhostButton type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Reading design…' : '⬆ Upload Canva design'}
        </GhostButton>
        {error && (
          <div className="mt-2">
            <Banner tone="error">{error}</Banner>
          </div>
        )}
      </div>
    )
  }

  const aspect = design.width / design.height
  const aspectOff = Math.abs(aspect / (297 / 210) - 1) > 0.03
  const keys = Object.keys(fields)
  const dataKeys = keys.filter(isDataField)
  const otherKeys = keys.filter((k) => !isDataField(k))
  const f = selectedKey && fields[selectedKey]

  const row = (key) => (
    <li key={key} className={`flex items-center gap-2 rounded px-1.5 py-1 text-xs ${key === selectedKey ? 'bg-sky-50 text-sky-800' : 'text-gray-600'}`}>
      <input type="checkbox" checked={!fields[key].hidden} onChange={(e) => onFieldChange(key, { hidden: !e.target.checked })} className="h-3.5 w-3.5 accent-sky-600" />
      <button type="button" onClick={() => onSelect(key)} className="min-w-0 flex-1 truncate text-left">
        {labelOf(key)}
      </button>
    </li>
  )

  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/40 p-3">
      <div className={sectionTitle}>Canva design</div>
      <div className="mb-2 flex items-center gap-2">
        <img src={design.dataUrl} alt="" className="h-10 w-14 shrink-0 rounded border border-gray-200 bg-white object-cover" />
        <div className="min-w-0 flex-1 text-xs">
          <div className="truncate font-medium text-gray-700">{design.name}</div>
          <div className="text-gray-400">
            Used for every {typeLabel} · {design.width}×{design.height}px
          </div>
        </div>
      </div>
      {aspectOff && (
        <p className="mb-2 text-[11px] font-medium text-amber-700">
          This design isn&apos;t A4 landscape, so it&apos;s stretched to fit the page. Set the Canva size to 297 × 210 mm for an exact fit.
        </p>
      )}
      {picker}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <GhostButton type="button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Reading…' : 'Replace design'}
        </GhostButton>
        <GhostButton type="button" onClick={onResetAll}>
          Reset field positions
        </GhostButton>
        <GhostButton type="button" onClick={onRemove} className="hover:border-red-200 hover:bg-red-50 hover:text-red-700">
          Remove design
        </GhostButton>
      </div>
      {error && (
        <div className="mb-2">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      <p className="mb-1.5 text-[11px] text-gray-500">Tick what to print on your design, then drag each box on the page into place.</p>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Live data</div>
      <ul className="mb-2">{dataKeys.map(row)}</ul>
      {otherKeys.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-gray-500">Other text (off — usually part of the design)</summary>
          <ul className="mt-1">{otherKeys.map(row)}</ul>
        </details>
      )}

      {f && (
        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-sky-800">{labelOf(selectedKey)}</span>
            <button type="button" onClick={() => onResetField(selectedKey)} className="shrink-0 text-[11px] font-medium text-brand-green hover:underline">
              Reset field
            </button>
          </div>
          {f.kind === 'image' ? (
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Width (mm)
              <input
                type="number"
                min="5"
                step="1"
                value={Math.round(f.w * 10) / 10}
                onChange={(e) => {
                  const w = Math.max(5, Number(e.target.value) || f.w)
                  onFieldChange(selectedKey, { w, h: w * (f.h / f.w) })
                }}
                className="w-20 rounded border border-gray-300 px-1.5 py-1 text-xs"
              />
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <label className="col-span-2 flex items-center gap-2">
                Font
                <select value={f.font} onChange={(e) => onFieldChange(selectedKey, { font: e.target.value })} className="flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs">
                  {DESIGN_FONTS.map((o) => (
                    <option key={o.font} value={o.font}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                Size
                <input
                  type="number"
                  min="4"
                  max="72"
                  step="0.5"
                  value={f.size}
                  onChange={(e) => onFieldChange(selectedKey, { size: Math.max(4, Number(e.target.value) || f.size) })}
                  className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-2">
                Colour
                <input type="color" value={toHex(f.color)} onChange={(e) => onFieldChange(selectedKey, { color: fromHex(e.target.value) })} className="h-7 w-10 cursor-pointer rounded border border-gray-300" />
              </label>
              <div className="flex gap-1">
                {[
                  ['normal', 'Regular'],
                  ['bold', 'Bold'],
                  ['italic', 'Italic'],
                ].map(([style, label]) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onFieldChange(selectedKey, { style })}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${f.style === style ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-1">
                {[
                  ['left', '⇤'],
                  ['center', '↔'],
                  ['right', '⇥'],
                ].map(([align, icon]) => (
                  <button
                    key={align}
                    type="button"
                    title={`Align ${align}`}
                    onClick={() => onFieldChange(selectedKey, { align })}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${f.align === align ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-gray-200'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
