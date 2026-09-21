import { useState } from 'react'
import { Tabs } from '../components/Tabs.jsx'
import { CalculatorPanel } from '../components/CalculatorPanel.jsx'
import { CertificateGenerator } from '../components/CertificateGenerator.jsx'
import { ReportGenerator } from '../components/ReportGenerator.jsx'
import logoUrl from '../assets/certificate/logo.png'

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

  // The Certificate's own RR picker (date range + RR number) also adds that
  // same RR to the Report as a row — one RR selection feeds both documents,
  // even though they're on separate tabs.
  function handleRrSelectedForReport(summary) {
    setReportRowToAdd({ source: 'rr', summary })
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-black/10 bg-brand-navy">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <img src={logoUrl} alt="EnviroCycle" className="h-5 w-auto" />
          <span className="h-4 w-px bg-white/20" />
          <span className="text-xs font-medium uppercase tracking-widest text-white/70">ESG Document Suite</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-brand-navy">Impact Calculator &amp; ESG Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Calculate impact from weight and material split, or load records straight from the Receiving Report
            Google Sheet, then generate an EnviroCycle-branded PDF certificate or a Carbon Abatement PDF report.
          </p>
        </header>

        <div className="mb-6 max-w-lg">
          <Tabs tabs={TABS} active={active} onChange={setActive} />
        </div>

        {active === 'calculator' && <CalculatorPanel onUseInCertificate={handleUseInCertificate} onAddToReport={handleAddToReport} />}

        {active === 'certificate' && (
          <CertificateGenerator
            prefillCalculation={certificatePrefill}
            onPrefillConsumed={() => setCertificatePrefill(null)}
            onRrSelected={handleRrSelectedForReport}
          />
        )}

        {active === 'report' && <ReportGenerator rowToAdd={reportRowToAdd} onRowConsumed={() => setReportRowToAdd(null)} />}
      </div>
    </div>
  )
}
