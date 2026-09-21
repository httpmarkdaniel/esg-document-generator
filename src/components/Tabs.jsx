export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-brand-green-light p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
            active === tab.id
              ? 'bg-white text-brand-green shadow-sm'
              : 'text-gray-500 hover:text-brand-green-dark'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
