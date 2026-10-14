import { useEffect, useMemo, useState } from 'react'
import { Card, GhostButton } from './Card.jsx'
import { EditablePage } from './editor/EditablePage.jsx'
import { TextBoxesLayer } from './editor/TextBoxesLayer.jsx'
import { ImagesSection, TextFieldsSection } from './editor/EditorPanels.jsx'
import { withText, withoutKey, countEdits } from './editor/overrides.js'
import { placedImagesFromFiles } from './editor/placeImages.js'
import { generateRrPdf } from '../receivingReport/generateRrPdf.js'
import { rrTextFields } from '../receivingReport/rrReportText.js'
import { renderPdfPagesToImages } from '../lib/renderPdfPage.js'

// The RR is A4 portrait, in mm (jsPDF's unit in generateRrPdf.js).
const PAGE_W_MM = 210
const PAGE_H_MM = 297
// How long typing has to pause before the PDF preview re-renders.
const PREVIEW_DEBOUNCE_MS = 400

// On-page keys of line-item cells: "item:<row index>:<field>" (see rrReportTemplate.js).
const parseItemKey = (key) => {
  const m = /^item:(\d+):(\w+)$/.exec(key)
  return m ? { index: Number(m[1]), field: m[2] } : null
}

/**
 * The real RR PDF (the exact file "Download" saves), every page, re-rendered
 * live — with the same editor as the certificate and report: click any text
 * on the page (labels, values, empty cells, line items) to type over it, or
 * drop an image (e.g. a signature) anywhere on a page.
 *
 * Header/label text is stored as `overrides`; line-item cells edit the item
 * data itself (`items` / `onItemChange`), so the totals follow.
 */
export function RrPreviewEditor({ data, overrides, onOverridesChange, images, onImagesChange, originalItems, onItemChange, actions }) {
  const [pages, setPages] = useState([])
  const [layout, setLayout] = useState({ pageCount: 0, textBoxes: [] })
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [imageError, setImageError] = useState(null)
  const [activeTextKey, setActiveTextKey] = useState(null)

  // While editing, added images are draggable boxes over the pages, so the
  // rendered pages leave them out; outside editing they're rendered in.
  const renderData = useMemo(() => ({ ...data, textOverrides: overrides, placedImages: editing ? [] : images }), [data, overrides, images, editing])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setRendering(true)
      try {
        const { blob, layout: nextLayout } = await generateRrPdf(renderData)
        const srcs = await renderPdfPagesToImages(blob, 1400)
        if (cancelled) return
        setPages(srcs)
        setLayout(nextLayout)
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

  const fields = useMemo(() => rrTextFields(data), [data])
  const defaults = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f.value])), [fields])
  const editedCount = countEdits(overrides, fields)
  const lastPage = Math.max(0, pages.length - 1)
  const pageOf = (img) => Math.min(img.page ?? 0, lastPage)

  function valueOf(key) {
    const item = parseItemKey(key)
    if (item) return data.items[item.index]?.[item.field] ?? ''
    return key in overrides ? overrides[key] : (defaults[key] ?? '')
  }
  function defaultOf(key) {
    const item = parseItemKey(key)
    if (item) return originalItems[item.index]?.[item.field] ?? ''
    return defaults[key] ?? ''
  }
  function saveText(key, value) {
    const item = parseItemKey(key)
    if (item) onItemChange(item.index, item.field, value)
    else onOverridesChange(withText(overrides, key, value, defaults[key] ?? ''))
  }
  function resetText(key) {
    const item = parseItemKey(key)
    if (item) onItemChange(item.index, item.field, defaultOf(key))
    else onOverridesChange(withoutKey(overrides, key))
  }

  function setPageImages(page, pageImages) {
    onImagesChange((prev) => [...prev.filter((img) => pageOf(img) !== page), ...pageImages])
  }

  async function addImageFiles(files, at, page = 0) {
    const { added, error } = await placedImagesFromFiles(files, { at, page, pageW: PAGE_W_MM, pageH: PAGE_H_MM })
    setImageError(error)
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

  return (
    <Card
      title="Receiving Report Preview"
      subtitle="This is the exact PDF that gets downloaded, every page — it updates as you edit. Click ✎ Edit RR, then click any text or empty cell on the page to type in it."
    >
      {actions && <div className="mb-4 border-b border-gray-100 pb-4">{actions}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {rendering ? 'Updating preview…' : renderError || `Up to date · ${pages.length} page(s)`}
          {editedCount > 0 && (
            <>
              {' '}
              · <strong className="text-amber-700">{editedCount} edit(s) applied</strong>
            </>
          )}
          {images.length > 0 && (
            <>
              {' '}
              · <strong className="text-amber-700">{images.length} image(s) added</strong>
            </>
          )}
        </span>
        <div className="flex gap-2">
          {editedCount > 0 && (
            <GhostButton type="button" onClick={() => onOverridesChange({})}>
              Reset all edits
            </GhostButton>
          )}
          <GhostButton
            type="button"
            onClick={() => {
              setEditing((e) => !e)
              setActiveTextKey(null)
            }}
            className={editing ? 'border-brand-green bg-brand-green-light text-brand-green-dark' : ''}
          >
            {editing ? 'Done editing' : '✎ Edit RR'}
          </GhostButton>
        </div>
      </div>

      <div className={`grid gap-4 ${editing ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="max-h-[80vh] overflow-y-auto rounded-lg bg-gray-100 p-3">
          <div className="mx-auto flex max-w-[760px] flex-col gap-4">
            {pages.length === 0 && <div className="py-20 text-center text-xs text-gray-400">Rendering preview…</div>}
            {pages.map((src, page) => (
              <div key={page}>
                <div className="mb-1 text-[11px] text-gray-400">Page {page + 1}</div>
                <EditablePage
                  src={src}
                  pageW={PAGE_W_MM}
                  pageH={PAGE_H_MM}
                  editing={editing}
                  images={images.filter((img) => pageOf(img) === page)}
                  onImagesChange={(pageImages) => setPageImages(page, pageImages)}
                  selectedImageId={selectedImageId}
                  onSelectImage={setSelectedImageId}
                  onDropFiles={(files, at) => addImageFiles(files, at, page)}
                  label={`Receiving report page ${page + 1}`}
                  extraLayer={
                    <TextBoxesLayer
                      boxes={(layout.textBoxes || []).filter((b) => b.page === page)}
                      pageW={PAGE_W_MM}
                      pageH={PAGE_H_MM}
                      valueOf={valueOf}
                      defaultOf={defaultOf}
                      onSave={saveText}
                      onReset={resetText}
                      activeKey={activeTextKey}
                      onActivate={(box) => setActiveTextKey(box ? box.key : null)}
                      fontFamily="Arial, Helvetica, sans-serif"
                      lineRatio={1.15}
                      minEditorW={45}
                    />
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {editing && (
          <div className="max-h-[80vh] overflow-y-auto rounded-lg border border-gray-200 p-3">
            <ImagesSection
              images={images}
              selectedId={selectedImageId}
              onSelect={setSelectedImageId}
              onRemove={removeImage}
              onAddFiles={(files) => addImageFiles(files)}
              error={imageError}
              pageLabel={(img) => `p. ${pageOf(img) + 1}`}
            />
            <TextFieldsSection
              fields={fields}
              overrides={overrides}
              onTextChange={(key, value, defaultValue) => onOverridesChange(withText(overrides, key, value, defaultValue))}
              onReset={(key) => onOverridesChange(withoutKey(overrides, key))}
              onShowSignatures={() => {}}
            />
          </div>
        )}
      </div>
    </Card>
  )
}
