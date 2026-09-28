import { useState } from 'react'
import { PlacedImagesLayer } from './PlacedImagesLayer.jsx'
import { BuiltInImagesLayer } from './BuiltInImagesLayer.jsx'

/**
 * One rendered PDF page in a preview editor: the page image, plus (in edit
 * mode) remove/move targets on the built-in images and the draggable images
 * added to this page. Drop an image file anywhere on the page to add it
 * there. All positions are mm on a `pageW × pageH` page, so they map 1:1 to
 * percentages of this box.
 */
export function EditablePage({
  src,
  pageW,
  pageH,
  editing,
  builtInBoxes = [],
  onHideBuiltIn,
  onEditBuiltIn,
  images = [],
  onImagesChange,
  selectedImageId,
  onSelectImage,
  onDropFiles,
  label = 'Page preview',
}) {
  const [dropActive, setDropActive] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDropActive(false)
    if (!e.dataTransfer.files?.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    onDropFiles(e.dataTransfer.files, {
      x: ((e.clientX - rect.left) / rect.width) * pageW,
      y: ((e.clientY - rect.top) / rect.height) * pageH,
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div
        className={`relative w-full ${dropActive ? 'ring-4 ring-inset ring-brand-green/40' : ''}`}
        style={{ aspectRatio: `${pageW} / ${pageH}` }}
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}
        onPointerDown={() => onSelectImage(null)}
      >
        {src ? (
          <img src={src} alt={label} draggable={false} className="absolute inset-0 h-full w-full select-none" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">Rendering preview…</div>
        )}
        {editing && <BuiltInImagesLayer boxes={builtInBoxes} pageW={pageW} pageH={pageH} onHide={onHideBuiltIn} onEdit={onEditBuiltIn} />}
        {editing && (
          <PlacedImagesLayer images={images} onChange={onImagesChange} selectedId={selectedImageId} onSelect={onSelectImage} pageW={pageW} pageH={pageH} />
        )}
        {dropActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand-green/10 text-sm font-semibold text-brand-green-dark">
            Drop image to add it here
          </div>
        )}
      </div>
    </div>
  )
}
