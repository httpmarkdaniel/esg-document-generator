import { useState } from 'react'
import { Tabs } from '../components/Tabs.jsx'
import { CertificateGenerator } from '../components/CertificateGenerator.jsx'
import { ReportGenerator } from '../components/ReportGenerator.jsx'

const TABS = [
  { id: 'certificate', label: 'Certificate' },
  { id: 'report', label: 'ESG Report' },
]

export function ESGDocumentsPage() {
  const [active, setActive] = useState('certificate')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">ESG Calculator</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Generate ESG Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your environmental impact values to generate a PDF certificate or a Word ESG report. Templates shown
          here are temporary and will be replaced with the official designs.
        </p>
      </header>

      <div className="mb-6 max-w-md">
        <Tabs tabs={TABS} active={active} onChange={setActive} />
      </div>

      {active === 'certificate' ? <CertificateGenerator /> : <ReportGenerator />}
    </div>
  )
}
