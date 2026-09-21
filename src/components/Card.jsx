export function Card({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-brand-green/10 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_28px_-12px_rgba(0,103,55,0.14)] ${className}`}
    >
      {title && (
        <div className="mb-4 flex items-start gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" />
          <div>
            <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </section>
  )
}

export function PrimaryButton({ children, loading, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-green/20 transition hover:bg-brand-green-dark hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/25 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  )
}

export function GhostButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-green/30 hover:bg-brand-green-light hover:text-brand-green-dark ${className}`}
    >
      {children}
    </button>
  )
}

export function Banner({ tone = 'error', children }) {
  const tones = {
    error: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-brand-green/20 bg-brand-green-light text-brand-green-dark',
    info: 'border-gray-200 bg-gray-50 text-gray-600',
  }
  return <div className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
}
