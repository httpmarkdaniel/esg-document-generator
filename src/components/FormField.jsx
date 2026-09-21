export function FormField({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

const baseInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export function TextInput(props) {
  return <input {...props} className={`${baseInputClass} ${props.className ?? ''}`} />
}

export function TextArea(props) {
  return <textarea {...props} className={`${baseInputClass} resize-y ${props.className ?? ''}`} />
}

export function inputErrorClass(hasError) {
  return hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''
}
