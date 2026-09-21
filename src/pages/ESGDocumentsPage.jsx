import { useRef, useState } from 'react'
import { Tabs } from '../components/Tabs.jsx'
import { CalculatorPanel } from '../components/CalculatorPanel.jsx'
import { CertificateGenerator } from '../components/CertificateGenerator.jsx'
import { ReportGenerator } from '../components/ReportGenerator.jsx'
import { Card, PrimaryButton, Banner } from '../components/Card.jsx'
import { downloadBlob } from '../lib/download.js'

const TABS = [
  { id: 'calculator', label: 'Impact Calculator' },
  { id: 'documents', label: 'Generate Documents' },
]

export function ESGDocumentsPage() {
  const [active, setActive] = useState('calculator')
  const [certificatePrefill, setCertificatePrefill] = useState(null)
  const [reportRowToAdd, setReportRowToAdd] = useState(null)

  const certRef = useRef(null)
  const reportRef = useRef(null)
  const [generatingBoth, setGeneratingBoth] = useState(false)
  const [combinedStatus, setCombinedStatus] = useState(null)

  function handleUseInCertificate(calculation) {
    setCertificatePrefill(calculation)
    setActive('documents')
  }

  function handleAddToReport(calculation) {
    setReportRowToAdd(calculation)
    setActive('documents')
  }

  // The Certificate's own RR picker (date range + RR number) also adds that
  // same RR to the Report as a row — one RR selection feeds both documents.
  function handleRrSelectedForReport(summary) {
    setReportRowToAdd({ source: 'rr', summary })
  }

  async function handleGenerateBoth() {
    setGeneratingBoth(true)
    setCombinedStatus(null)
    try {
      const certResult = await certRef.current?.generate()
      if (!certResult?.ok) {
        setCombinedStatus({ tone: 'error', message: 'Fix the Certificate section above before generating.' })
        return
      }
      const reportResult = await reportRef.current?.generate()
      if (!reportResult?.ok) {
        setCombinedStatus({ tone: 'error', message: 'Certificate looked good, but the Report section needs fixing before generating.' })
        return
      }

      downloadBlob(certResult.blob, certResult.filename)
      // Stagger the second download slightly — back-to-back programmatic
      // downloads can otherwise get blocked as "multiple automatic downloads".
      await new Promise((resolve) => setTimeout(resolve, 400))
      downloadBlob(reportResult.blob, reportResult.filename)

      setCombinedStatus({ tone: 'success', message: `Generated ${certResult.filename} and ${reportResult.filename}.` })
    } finally {
      setGeneratingBoth(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">ESG Calculator</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Impact Calculator &amp; ESG Documents</h1>
        <p className="mt-1 text-sm text-gray-500">
          Calculate impact from weight and material split, load records straight from the Receiving Report Google
          Sheet, then generate the EnviroCycle-branded certificate and Carbon Abatement report — both PDFs — in one
          click.
        </p>
      </header>

      <div className="mb-6 max-w-lg">
        <Tabs tabs={TABS} active={active} onChange={setActive} />
      </div>

      {active === 'calculator' && <CalculatorPanel onUseInCertificate={handleUseInCertificate} onAddToReport={handleAddToReport} />}

      {active === 'documents' && (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Certificate</h2>
            <CertificateGenerator
              ref={certRef}
              prefillCalculation={certificatePrefill}
              onPrefillConsumed={() => setCertificatePrefill(null)}
              onRrSelected={handleRrSelectedForReport}
              hideActions
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">ESG Report</h2>
            <ReportGenerator ref={reportRef} rowToAdd={reportRowToAdd} onRowConsumed={() => setReportRowToAdd(null)} hideActions />
          </section>

          <Card className="sticky bottom-4 shadow-lg">
            <div className="flex flex-col gap-3">
              {combinedStatus && <Banner tone={combinedStatus.tone}>{combinedStatus.message}</Banner>}
              <PrimaryButton type="button" onClick={handleGenerateBoth} loading={generatingBoth} className="text-base">
                {generatingBoth ? 'Generating…' : 'Generate Certificate + Report (PDF)'}
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
