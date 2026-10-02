import { useEffect, useMemo, useState } from 'react'
import { Card, GhostButton } from './Card.jsx'
import { EditablePage } from './editor/EditablePage.jsx'
import { DesignPanel } from './editor/DesignPanel.jsx'
import { DesignFieldsLayer } from './editor/DesignFieldsLayer.jsx'
import { TextBoxesLayer } from './editor/TextBoxesLayer.jsx'
import { ImagesSection, BuiltInSection, TextFieldsSection } from './editor/EditorPanels.jsx'
import { withText, withoutKey, withSignatures, withHiddenImages, hiddenImageSet, countEdits } from './editor/overrides.js'
import { placedImagesFromFiles } from './editor/placeImages.js'
import { generateCertificatePdf } from '../certificate/generateCertificatePdf.js'
import { loadCertificateAssets } from '../certificate/assets.js'
import { certificateTextFields } from '../certificate/certificateText.js'
import { PAGE_W_MM, PAGE_H_MM } from '../certificate/page.js'
import { HEADER_LOGO_BOX, LOGO_ID, ICONS_ID, COMPLIANCE_LOGOS, complianceLogoBoxes } from '../certificate/builtInImages.js'
import { mergeDesignFields, fieldLabel } from '../certificate/customDesign.js'
import { renderPdfPagesToImages } from '../lib/renderPdfPage.js'
import { designFromFile } from '../lib/designFile.js'
import { CERTIFICATE_TYPES } from '../lib/brand.js'

// How long typing has to pause before the PDF preview re-renders.
const PREVIEW_DEBOUNCE_MS = 350

/**
 * The real certificate PDF (the exact file "Generate" downloads), re-rendered
 * live as the form changes, plus an editor for every piece of text printed on
 * it, for added images, and for the certificate's own logos. Text edits are
 * overrides on top of the auto-generated text: typing replaces a line,
 * clearing it hides the line, Reset restores the auto text.
 *
 * With a custom (Canva) design for this certificate type (`design`, see
 * certificate/customDesign.js), the design replaces the built-in layout and
 * the live data fields are dragged into place on top of it.
 */
export function CertificatePreviewEditor({ data, overrides, onOverridesChange, images, onImagesChange, design, onDesignChange, actions }) {
  const [pageSrc, setPageSrc] = useState(null)
  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState(null)
  const [imageError, setImageError] = useState(null)
  // Last render's layout: default field positions, and (with a design) the fields + their page boxes.
  const [layout, setLayout] = useState({ fields: {} })
  const [selectedFieldKey, setSelectedFieldKey] = useState(null)
  const [designUploading, setDesignUploading] = useState(false)
  const [designError, setDesignError] = useState(null)
  // The text field being edited right on the certificate (its key), if any.
  const [activeTextKey, setActiveTextKey] = useState(null)

  // While editing, the added images are shown as draggable boxes over the
  // preview (so moving one is instant), so the rendered page leaves them out;
  // outside editing they're rendered into the page like the final PDF.
  const renderData = useMemo(() => ({ ...data, customDesign: design, placedImages: editing ? [] : images }), [data, design, images, editing])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setRendering(true)
      try {
        const { blob, layout: nextLayout } = await generateCertificatePdf(renderData)
        const [src] = await renderPdfPagesToImages(blob, 2200)
        if (cancelled) return
        setPageSrc(src)
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

  // Defaults come from the data WITHOUT overrides, so the editor can show
  // what Reset goes back to.
  const fields = useMemo(() => certificateTextFields({ ...data, textOverrides: {} }), [data])
  const defaults = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f.value])), [fields])
  const valueOf = (key) => (key in overrides ? overrides[key] : defaults[key] ?? '')
  const hidden = useMemo(() => hiddenImageSet(overrides), [overrides])
  const editedCount = countEdits(overrides, fields)
  const builtInBoxes = useMemo(
    () => [...(hidden.has(LOGO_ID) ? [] : [{ id: LOGO_ID, name: 'EnviroCycle logo', ...HEADER_LOGO_BOX }]), ...complianceLogoBoxes(hidden)].map((b) => ({ ...b, movable: true })),
    [hidden],
  )

  /** Restore built-in images, dropping any movable copies made of them (so they don't show twice). */
  function restoreImages(ids) {
    const restoring = new Set(ids)
    onOverridesChange(withHiddenImages(overrides, ids, false))
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
    onImagesChange([...images, { id, name: box.name, dataUrl, page: 0, x: box.x, y: box.y, w: box.w, h: box.h, sourceId: box.id }])
    onOverridesChange(withHiddenImages(overrides, [box.id], true))
    setSelectedImageId(id)
  }

  // --- custom design ------------------------------------------------------
  const typeLabel = CERTIFICATE_TYPES[data.certificateType]?.label ?? 'certificate'
  // Field settings now (defaults from the last render + this design's changes) — what the drag handles follow.
  const designFields = useMemo(() => (design ? mergeDesignFields(layout.fields || {}, design.fields) : {}), [design, layout.fields])
  const labelOf = (key) => fieldLabel(key, fields)

  async function uploadDesign(file) {
    setDesignUploading(true)
    setDesignError(null)
    try {
      const page = await designFromFile(file)
      // Replacing a design keeps the field positions already set.
      onDesignChange({ ...page, fields: design?.fields ?? {} })
      setEditing(true)
    } catch (err) {
      console.error(err)
      setDesignError(err.message || 'Could not read that design.')
    } finally {
      setDesignUploading(false)
    }
  }

  function changeField(key, patch) {
    onDesignChange({ ...design, fields: { ...design.fields, [key]: { ...design.fields?.[key], ...patch } } })
  }

  function resetField(key) {
    const next = { ...design.fields }
    delete next[key]
    onDesignChange({ ...design, fields: next })
  }

  async function addImageFiles(files, at) {
    const { added, error } = await placedImagesFromFiles(files, { at, pageW: PAGE_W_MM, pageH: PAGE_H_MM })
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
    <Card title="Certificate Preview" subtitle="This is the exact PDF that gets generated — it updates as you change the form. Click ✎ Edit certificate, then click any text on the certificate to edit it right there.">
      {actions && <div className="mb-4 border-b border-gray-100 pb-4">{actions}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {rendering ? 'Updating preview…' : renderError || 'Up to date'}
          {editedCount > 0 && <> · <strong className="text-amber-700">{editedCount} edit(s) applied</strong></>}
          {images.length > 0 && <> · <strong className="text-amber-700">{images.length} image(s) added</strong></>}
          {design && <> · <strong className="text-sky-700">Using your Canva design</strong></>}
        </span>
        <div className="flex gap-2">
          {editedCount > 0 && (
            <GhostButton type="button" onClick={() => onOverridesChange({})}>
              Reset all edits
            </GhostButton>
          )}
          {!editing && (
            <GhostButton type="button" onClick={() => setEditing(true)} className="border-sky-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800">
              {design ? '🎨 Canva design ✓' : '🎨 Use a Canva design'}
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
            {editing ? 'Done editing' : '✎ Edit certificate'}
          </GhostButton>
        </div>
      </div>

      <div className={`grid gap-4 ${editing ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}>
        <div className="self-start">
          <EditablePage
            src={pageSrc}
            pageW={PAGE_W_MM}
            pageH={PAGE_H_MM}
            editing={editing}
            builtInBoxes={design ? [] : builtInBoxes}
            onHideBuiltIn={(id) => onOverridesChange(withHiddenImages(overrides, [id], true))}
            onEditBuiltIn={editBuiltInImage}
            images={images}
            onImagesChange={onImagesChange}
            selectedImageId={selectedImageId}
            onSelectImage={setSelectedImageId}
            onDropFiles={addImageFiles}
            label="Certificate preview"
            extraLayer={
              design && layout.fieldBoxes ? (
                <DesignFieldsLayer
                  boxes={layout.fieldBoxes}
                  renderedFields={layout.customFields || {}}
                  fields={designFields}
                  pageW={PAGE_W_MM}
                  pageH={PAGE_H_MM}
                  selectedKey={selectedFieldKey}
                  onSelect={setSelectedFieldKey}
                  onFieldChange={changeField}
                  labelOf={labelOf}
                />
              ) : (
                <TextBoxesLayer
                  boxes={layout.textBoxes || []}
                  pageW={PAGE_W_MM}
                  pageH={PAGE_H_MM}
                  valueOf={valueOf}
                  defaultOf={(key) => defaults[key] ?? ''}
                  onSave={(key, value) => onOverridesChange(withText(overrides, key, value, defaults[key] ?? ''))}
                  onReset={(key) => onOverridesChange(withoutKey(overrides, key))}
                  activeKey={activeTextKey}
                  onActivate={(box) => setActiveTextKey(box ? box.key : null)}
                  fontFamily="Poppins, system-ui, sans-serif"
                  lineRatio={1.15}
                  minEditorW={90}
                />
              )
            }
          />
          <p className="mt-1.5 text-[11px] text-gray-400">Tip: in edit mode, click any text to edit it in place, or drag an image file (e.g. a client logo) onto the certificate to add it.</p>
        </div>

        {editing && (
          <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 p-3 lg:max-h-none lg:h-0 lg:min-h-full">
            <DesignPanel
              design={design}
              fields={designFields}
              typeLabel={typeLabel}
              selectedKey={selectedFieldKey}
              onSelect={setSelectedFieldKey}
              onUpload={uploadDesign}
              onRemove={() => {
                onDesignChange(null)
                setSelectedFieldKey(null)
              }}
              onFieldChange={changeField}
              onResetField={resetField}
              onResetAll={() => onDesignChange({ ...design, fields: {} })}
              uploading={designUploading}
              error={designError}
              labelOf={labelOf}
            />
            <ImagesSection
              images={images}
              selectedId={selectedImageId}
              onSelect={setSelectedImageId}
              onRemove={removeImage}
              onAddFiles={(files) => addImageFiles(files)}
              error={imageError}
            />
            {!design && (
            <BuiltInSection
              toggles={[
                { id: LOGO_ID, label: 'EnviroCycle logo (header)' },
                { id: ICONS_ID, label: 'Stat icons' },
              ]}
              logos={COMPLIANCE_LOGOS}
              hidden={hidden}
              images={images}
              onHide={(id) => onOverridesChange(withHiddenImages(overrides, [id], true))}
              onRestore={restoreImages}
            />
            )}
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
