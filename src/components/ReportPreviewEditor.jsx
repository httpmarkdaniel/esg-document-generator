import { useEffect, useMemo, useState } from 'react'
import { Card, GhostButton } from './Card.jsx'
import { EditablePage } from './editor/EditablePage.jsx'
import { ImagesSection, BuiltInSection, TextFieldsSection } from './editor/EditorPanels.jsx'
import { withText, withoutKey, withSignatures, withHiddenImages, hiddenImageSet, countEdits } from './editor/overrides.js'
import { placedImagesFromFiles } from './editor/placeImages.js'
import { generateReportPdf } from '../reports/generateReportPdf.js'
import { reportTextFields } from '../reports/reportText.js'
import { LETTERHEAD_ID, GRADIENT_BAR_ID, REPORT_COMPLIANCE_LOGOS } from '../reports/reportBuiltInImages.js'
import { renderPdfPagesToImages } from '../lib/renderPdfPage.js'

// The report is A4 portrait, in mm (jsPDF's unit in generateReportPdf.js).
const PAGE_W_MM = 210
const PAGE_H_MM = 297
// How long typing has to pause before the PDF preview re-renders.
const PREVIEW_DEBOUNCE_MS = 400

/**
 * The real report PDF (the exact file "Generate" downloads), every page,
 * re-rendered live as the form changes — plus the same editor as the
 * certificate: every line of text, added images (dropped on any page), and
 * the report's own images (letterhead, top bar, form code, compliance logos).
 */
export function ReportPreviewEditor({ data, overrides, onOverridesChange, images, onImagesChange, actions }) {
  const [pages, setPages] = useState([])
  const [layout, setLayout] = useState({ pageCount: 0, builtInBoxes: [] })
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [imageError, setImageError] = useState(null)

  // While editing, added images are draggable boxes over the pages, so the
  // rendered pages leave them out; outside editing they're rendered in.
  const renderData = useMemo(() => ({ ...data, placedImages: editing ? [] : images }), [data, images, editing])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setRendering(true)
      try {
        const { blob, layout: nextLayout } = await generateReportPdf(renderData)
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

  const fields = useMemo(() => reportTextFields({ ...data, textOverrides: {} }), [data])
  const hidden = useMemo(() => hiddenImageSet(overrides), [overrides])
  const editedCount = countEdits(overrides, fields)
  // An image placed on a page that no longer exists (the report got shorter) shows — and prints — on the last page.
  const lastPage = Math.max(0, pages.length - 1)
  const pageOf = (img) => Math.min(img.page ?? 0, lastPage)

  function setPageImages(page, pageImages) {
    onImagesChange((prev) => [...prev.filter((img) => pageOf(img) !== page), ...pageImages])
  }

  function restoreImages(ids) {
    const restoring = new Set(ids)
    onOverridesChange(withHiddenImages(overrides, ids, false))
    if (images.some((img) => restoring.has(img.sourceId))) onImagesChange(images.filter((img) => !restoring.has(img.sourceId)))
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
    <Card title="Report Preview" subtitle="This is the exact PDF that gets generated, every page — it updates as you change the form.">
      {actions && <div className="mb-4 border-b border-gray-100 pb-4">{actions}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {rendering ? 'Updating preview…' : renderError || `Up to date · ${pages.length} page(s)`}
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
            {editing ? 'Done editing' : '✎ Edit report'}
          </GhostButton>
        </div>
      </div>

      <div className={`grid gap-4 ${editing ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="max-h-[80vh] overflow-y-auto rounded-lg bg-gray-100 p-3">
          <div className="mx-auto flex max-w-[720px] flex-col gap-4">
            {pages.length === 0 && <div className="py-20 text-center text-xs text-gray-400">Rendering preview…</div>}
            {pages.map((src, page) => (
              <div key={page}>
                <div className="mb-1 text-[11px] text-gray-400">Page {page + 1}</div>
                <EditablePage
                  src={src}
                  pageW={PAGE_W_MM}
                  pageH={PAGE_H_MM}
                  editing={editing}
                  builtInBoxes={layout.builtInBoxes.filter((b) => b.page === page)}
                  onHideBuiltIn={(id) => onOverridesChange(withHiddenImages(overrides, [id], true))}
                  onEditBuiltIn={() => {}}
                  images={images.filter((img) => pageOf(img) === page)}
                  onImagesChange={(pageImages) => setPageImages(page, pageImages)}
                  selectedImageId={selectedImageId}
                  onSelectImage={setSelectedImageId}
                  onDropFiles={(files, at) => addImageFiles(files, at, page)}
                  label={`Report page ${page + 1}`}
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
            <BuiltInSection
              toggles={[
                { id: LETTERHEAD_ID, label: 'Letterhead (every page)' },
                { id: GRADIENT_BAR_ID, label: 'Top colour bar (every page)' },
              ]}
              logos={REPORT_COMPLIANCE_LOGOS}
              hidden={hidden}
              images={images}
              onHide={(id) => onOverridesChange(withHiddenImages(overrides, [id], true))}
              onRestore={restoreImages}
            />
            <TextFieldsSection
              fields={fields}
              overrides={overrides}
              onTextChange={(key, value, defaultValue) => onOverridesChange(withText(overrides, key, value, defaultValue))}
              onReset={(key) => onOverridesChange(withoutKey(overrides, key))}
              onShowSignatures={(show) => onOverridesChange(withSignatures(overrides, show))}
            />
          </div>
        )}
      </div>
    </Card>
  )
}
