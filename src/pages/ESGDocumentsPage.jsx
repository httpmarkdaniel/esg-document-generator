import { useState } from 'react'
import { Tabs } from '../components/Tabs.jsx'
import { CalculatorPanel } from '../components/CalculatorPanel.jsx'
import { CertificateGenerator } from '../components/CertificateGenerator.jsx'
import { ReportGenerator } from '../components/ReportGenerator.jsx'

const TABS = [
  { id: 'calculator', label: 'Impact Calculator' },
  { id: 'certificate', label: 'Certificate' },
  { id: 'report', label: 'ESG Report' },
]

export function ESGDocumentsPage() {
  const [active, setActive] = useState('calculator')
  const [certificatePrefill, setCertificatePrefill] = useState(null)
  const [reportRowToAdd, setReportRowToAdd] = useState(null)

  function handleUseInCertificate(calculation) {
    setCertificatePrefill(calculation)
    setActive('certificate')
  }

  function handleAddToReport(calculation) {
    setReportRowToAdd(calculation)
    setActive('report')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">ESG Calculator</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Impact Calculator &amp; ESG Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Calculate impact from weight and material split, then generate an EnviroCycle-branded PDF certificate or a
          Carbon Abatement Word report straight from the result — no retyping. Logo artwork and compliance-logo
          strip are placeholders until the official assets are supplied.
        </p>
      </header>

      <div className="mb-6 max-w-lg">
        <Tabs tabs={TABS} active={active} onChange={setActive} />
      </div>

      {active === 'calculator' && <CalculatorPanel onUseInCertificate={handleUseInCertificate} onAddToReport={handleAddToReport} />}
      {active === 'certificate' && <CertificateGenerator prefillCalculation={certificatePrefill} onPrefillConsumed={() => setCertificatePrefill(null)} />}
      {active === 'report' && <ReportGenerator rowToAdd={reportRowToAdd} onRowConsumed={() => setReportRowToAdd(null)} />}
    </div>
  )
}
