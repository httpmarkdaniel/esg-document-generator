import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, GhostButton, Banner } from './Card.jsx'
import { TextInput, TextArea } from './FormField.jsx'
import { PlacedImagesLayer } from './PlacedImagesLayer.jsx'
import { BuiltInImagesLayer } from './BuiltInImagesLayer.jsx'
import { BUILT_IN_IMAGES, COMPLIANCE_LOGOS, LOGO_ID, ICONS_ID, hiddenImageSet } from '../certificate/builtInImages.js'
import { generateCertificatePdf } from '../certificate/generateCertificatePdf.js'
import { loadCertificateAssets } from '../certificate/assets.js'
import { certificateTextFields } from '../certificate/certificateText.js'
import { PAGE_W_MM, PAGE_H_MM } from '../certificate/page.js'
import { renderPdfPage } from '../lib/renderPdfPage.js'
import { imageFileToPng } from '../lib/imageFile.js'

// How long typing has to pause before the PDF preview re-renders.
const PREVIEW_DEBOUNCE_MS = 350
// Default size for a newly added image (e.g. a logo), fitted inside this box.
const NEW_IMAGE_MAX_W_MM = 45
const NEW_IMAGE_MAX_H_MM = 28

/**
 * The real certificate PDF (the exact file "Generate" downloads), re-rendered
 * live as the form changes, plus an optional editor for every piece of text
 * printed on it and for added images. Text edits are overrides on top of the
 * auto-generated text: typing replaces a line, clearing it hides the line,
 * Reset restores the auto text. Images (dropped onto the preview or picked
 * with "Add image") can be dragged, resized and removed.
 */
export function CertificatePreviewEditor({ data, overrides, onOverridesChange, images, onImagesChange, actions }) {
  const [hasPreview, setHasPreview] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [dropActive, setDropActive] = useState(false)
  const [imageError, setImageError] = useState(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)

  // While editing, the added images are shown as draggable boxes over the
  // preview (so moving one is instant), so the rendered page leaves them out;
  // outside editing they're rendered into the page like the final PDF.
  const renderData = useMemo(() => ({ ...data, placedImages: editing ? [] : images }), [data, images, editing])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setRendering(true)
      try {
        const { blob } = await generateCertificatePdf(renderData)
        if (cancelled) return
        // Render off-screen first, then swap in, so the preview never flashes blank.
        const offscreen = document.createElement('canvas')
        const cssWidth = canvasRef.current?.parentElement?.clientWidth || 1000
        await renderPdfPage(blob, offscreen, Math.min(cssWidth * (window.devicePixelRatio || 1), 2600))
        if (cancelled || !canvasRef.current) return
        const canvas = canvasRef.current
        canvas.width = offscreen.width
        canvas.height = offscreen.height
        canvas.getContext('2d').drawImage(offscreen, 0, 0)
        setHasPreview(true)
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
  }, [renderData])

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
  const hidden = useMemo(() => hiddenImageSet(overrides), [overrides])
  const editedCount = fields.filter((f) => f.key in overrides).length + (overrides.hideSignatures ? 1 : 0) + hidden.size

  /** Remove (hide) or restore one of the certificate's own images. */
  function setImageHidden(id, hide) {
    const next = new Set(hidden)
    if (hide) next.add(id)
    else next.delete(id)
    const nextOverrides = { ...overrides, hiddenImages: [...next] }
    if (!next.size) delete nextOverrides.hiddenImages
    onOverridesChange(nextOverrides)
  }

  /** Restore built-in images, dropping any movable copies made of them (so they don't show twice). */
  function restoreImages(ids) {
    const restoring = new Set(ids)
    const next = [...hidden].filter((id) => !restoring.has(id))
    const nextOverrides = { ...overrides, hiddenImages: next }
    if (!next.length) delete nextOverrides.hiddenImages
    onOverridesChange(nextOverrides)
    if (images.some((img) => restoring.has(img.sourceId))) onImagesChange(images.filter((img) => !restoring.has(img.sourceId)))
  }

  /**
   * Make a built-in logo movable/resizable: it's hidden from the template and
   * re-added as a placed image with the same picture, at the same spot and
   * size — so nothing moves until you drag it.
   */
  async function editBuiltInImage(box) {
    const assets = await loadCertificateAssets()
    const dataUrl = box.id === LOGO_ID ? assets.logo : assets.complianceStripPieces[box.id]
    if (!dataUrl) return
    const id = `builtin-${box.id}-${Date.now()}`
    onImagesChange([...images, { id, name: box.name, dataUrl, x: box.x, y: box.y, w: box.w, h: box.h, sourceId: box.id }])
    setImageHidden(box.id, true)
    setSelectedImageId(id)
  }

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

  /** Add image files, centered on `at` (mm) or the page center, each offset a little from the last. */
  async function addImageFiles(fileList, at) {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'))
    if (!files.length) {
      setImageError('Only image files (PNG, JPG, SVG, WebP…) can be added.')
      return
    }
    setImageError(null)
    const added = []
    for (const [i, file] of files.entries()) {
      try {
        const { dataUrl, width, height } = await imageFileToPng(file)
        const scale = Math.min(NEW_IMAGE_MAX_W_MM / width, NEW_IMAGE_MAX_H_MM / height)
        const w = width * scale
        const h = height * scale
        const cx = (at?.x ?? PAGE_W_MM / 2) + i * 6
        const cy = (at?.y ?? PAGE_H_MM / 2) + i * 6
        added.push({ id: `img-${Date.now()}-${i}`, name: file.name, dataUrl, x: cx - w / 2, y: cy - h / 2, w, h })
      } catch (err) {
        setImageError(err.message)
      }
    }
    if (added.length) {
      onImagesChange([...images, ...added])
      setSelectedImageId(added[added.length - 1].id)
      setEditing(true)
    }
  }

  function removeImage(id) {
    onImagesChange(images.filter((i) => i.id !== id))
    if (selectedImageId === id) setSelectedImageId(null)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDropActive(false)
    if (!e.dataTransfer.files?.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    addImageFiles(e.dataTransfer.files, {
      x: ((e.clientX - rect.left) / rect.width) * PAGE_W_MM,
      y: ((e.clientY - rect.top) / rect.height) * PAGE_H_MM,
    })
  }

  return (
    <Card title="Certificate Preview" subtitle="This is the exact PDF that gets generated — it updates as you change the form.">
      {actions && <div className="mb-4 border-b border-gray-100 pb-4">{actions}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {rendering ? 'Updating preview…' : renderError || 'Up to date'}
          {editedCount > 0 && <> · <strong className="text-amber-700">{editedCount} edit(s) applied</strong></>}
          {images.length > 0 && <> · <strong className="text-amber-700">{images.length} image(s) added</strong></>}
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
            {editing ? 'Done editing' : '✎ Edit certificate'}
          </GhostButton>
        </div>
      </div>

      <div className={`grid gap-4 ${editing ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="self-start">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {/* A4 landscape aspect ratio — the canvas IS the page, so mm positions map 1:1 to the overlay. */}
            <div
              className={`relative w-full ${dropActive ? 'ring-4 ring-inset ring-brand-green/40' : ''}`}
              style={{ aspectRatio: `${PAGE_W_MM} / ${PAGE_H_MM}` }}
              onDragOver={(e) => {
                if (![...e.dataTransfer.types].includes('Files')) return
                e.preventDefault()
                setDropActive(true)
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
              onPointerDown={() => setSelectedImageId(null)}
            >
              <canvas ref={canvasRef} aria-label="Certificate preview" className="absolute inset-0 h-full w-full" />
              {!hasPreview && <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Rendering preview…</div>}
              {editing && <BuiltInImagesLayer hidden={hidden} onHide={(id) => setImageHidden(id, true)} onEdit={editBuiltInImage} />}
              {editing && <PlacedImagesLayer images={images} onChange={onImagesChange} selectedId={selectedImageId} onSelect={setSelectedImageId} />}
              {dropActive && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-green/10 text-sm font-semibold text-brand-green-dark">
                  Drop image to add it here
                </div>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">Tip: drag an image file (e.g. a client logo) onto the certificate to add it.</p>
        </div>

        {editing && (
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 p-3 lg:max-h-none lg:h-0 lg:min-h-full">
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green">Images</div>
              <p className="mb-2 text-xs text-gray-500">Drop an image onto the certificate, or add one here. Drag it to move, drag its corner to resize.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addImageFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <GhostButton type="button" onClick={() => fileInputRef.current?.click()}>
                + Add image
              </GhostButton>
              {imageError && (
                <div className="mt-2">
                  <Banner tone="error">{imageError}</Banner>
                </div>
              )}
              {images.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {images.map((img) => (
                    <li
                      key={img.id}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${img.id === selectedImageId ? 'border-brand-green bg-brand-green-light' : 'border-gray-200'}`}
                    >
                      <button type="button" onClick={() => setSelectedImageId(img.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <img src={img.dataUrl} alt="" className="h-6 w-10 shrink-0 rounded bg-gray-300 object-contain p-0.5" />
                        <span className="truncate text-gray-700">{img.name}</span>
                      </button>
                      <button type="button" onClick={() => removeImage(img.id)} className="shrink-0 text-gray-400 hover:text-red-600" aria-label={`Remove ${img.name}`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green">Built-in images</div>
              <p className="mb-2 text-xs text-gray-500">
                On the certificate, click a logo to move or resize it, or click its ✕ to remove it. Changed logos are listed here to restore.
              </p>
              {[
                [LOGO_ID, 'EnviroCycle logo (header)'],
                [ICONS_ID, 'Stat icons'],
              ].map(([id, label]) => (
                <label key={id} className="mb-1.5 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!hidden.has(id)}
                    onChange={(e) => (e.target.checked ? restoreImages([id]) : setImageHidden(id, true))}
                    className="h-4 w-4 accent-brand-green"
                  />
                  {label}
                  {images.some((img) => img.sourceId === id) && <span className="text-gray-400">(moved/resized)</span>}
                </label>
              ))}
              {(() => {
                const removed = BUILT_IN_IMAGES.filter((img) => img.id.startsWith('strip:') && hidden.has(img.id))
                return (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        Compliance logos: {COMPLIANCE_LOGOS.length - removed.length} of {COMPLIANCE_LOGOS.length} shown
                      </span>
                      {removed.length > 0 && (
                        <button type="button" onClick={() => restoreImages(removed.map((img) => img.id))} className="font-medium text-brand-green hover:underline">
                          Restore all
                        </button>
                      )}
                    </div>
                    {removed.length > 0 && (
                      <ul className="flex flex-col gap-1">
                        {removed.map((img) => (
                          <li key={img.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500">
                            <span className="truncate">
                              {img.name} <span className="text-gray-400">{images.some((p) => p.sourceId === img.id) ? '(moved/resized)' : '(removed)'}</span>
                            </span>
                            <button type="button" onClick={() => restoreImages([img.id])} className="shrink-0 font-medium text-brand-green hover:underline">
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })()}
            </div>

            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-green">Text</div>
            <p className="mb-3 text-xs text-gray-500">
              Change any text on the certificate. Clear a field to remove that text. Stat values and the recipient block reset automatically when new RR or
              calculator data is loaded.
            </p>
            {sections.map(([section, sectionFields]) => (
              <div key={section} className="mb-4 last:mb-0">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{section}</div>
                {section === 'Signatories' && (
                  <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={!overrides.hideSignatures}
                      onChange={(e) => setShowSignatures(e.target.checked)}
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
