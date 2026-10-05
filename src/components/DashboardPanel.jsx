import { useEffect, useMemo, useState } from 'react'
import { Card, GhostButton } from './Card.jsx'
import { FormField, TextInput } from './FormField.jsx'
import { getAllRrSummaries } from '../rrData/rrClient.js'
import { normalizeCertificateData } from '../certificate/certificateData.js'
import { formatNumber, todayIso } from '../lib/format.js'

/**
 * Per-client totals of what the certificates would print, for every RR
 * received in the chosen period. Each client's RRs are combined exactly the
 * way the Certificate tab combines ticked RRs (summed net weight and material
 * breakdown), then run through the same normalizeCertificateData the
 * certificates use — so every figure here matches a certificate generated for
 * that client and period.
 */

// [key, header, value from the normalized certificate data, decimals]
const GROUPS = [
  {
    id: 'EIC',
    title: 'Environmental Impact Certificate',
    color: 'bg-emerald-50 text-emerald-800',
    columns: [
      ['eicCarbon', 'Carbon Saved (kg CO2e)', (d) => d.netCarbonAbatedKgCO2e, 2],
      ['eicLandfill', 'Landfill Diverted (kg)', (d) => d.landfillDivertedKg, 2],
      ['eicPlastic', 'Plastic Recycled (kg)', (d) => d.plasticRecycledKg, 2],
    ],
  },
  {
    id: 'CAC',
    title: 'Carbon Abatement Certificate',
    color: 'bg-sky-50 text-sky-800',
    columns: [
      ['cacCollected', 'Materials Recycled (kg)', (d) => d.materialsCollectedKg, 2],
      ['cacFootprint', 'Total Carbon Footprint (kg CO2e)', (d) => d.totalCarbonFootprintKgCO2e, 2],
      ['cacAbated', 'Net Carbon Abated (kg CO2e)', (d) => d.netCarbonAbatedKgCO2e, 2],
      ['cacRecycled', 'Recycled Emissions (kg CO2e)', (d) => d.recycledEmissionsKgCO2e, 2],
      ['cacKm', 'Carbon Benefits Equivalent (km avoided)', (d) => d.kmAvoided, 0],
    ],
  },
  {
    id: 'LDC',
    title: 'Landfill Diversion Certificate',
    color: 'bg-lime-50 text-lime-800',
    columns: [
      ['ldcCollected', 'Materials Collected (kg)', (d) => d.materialsCollectedKg, 2],
      ['ldcLandfill', 'Landfill Diverted (kg)', (d) => d.landfillDivertedKg, 2],
    ],
  },
]
const COLUMNS = GROUPS.flatMap((g) => g.columns)

/** One client's (or the total's) certificate figures from its RRs, same as a certificate combining those RRs. */
function figuresFor(summaries) {
  const sum = (fn) => summaries.reduce((s, r) => s + fn(r), 0)
  const totalNetWeight = sum((r) => r.totalNetWeight)
  const data = normalizeCertificateData({
    certificateType: 'EIC',
    materialsCollectedKg: totalNetWeight,
    landfillDivertedKg: totalNetWeight,
    materials: {
      metalKg: sum((r) => r.materialsKg.metalKg),
      plasticKg: sum((r) => r.materialsKg.plasticKg),
      glassKg: sum((r) => r.materialsKg.glassKg),
      electronicsKg: sum((r) => r.materialsKg.electronicsKg),
    },
  })
  return Object.fromEntries(COLUMNS.map(([key, , get]) => [key, get(data)]))
}

const iso = (d) => d.toISOString().slice(0, 10)
const PRESETS = [
  ['This month', () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth(), 1, 12)), todayIso()] }],
  ['Last month', () => { const t = new Date(); return [iso(new Date(t.getFullYear(), t.getMonth() - 1, 1, 12)), iso(new Date(t.getFullYear(), t.getMonth(), 0, 12))] }],
  ['This year', () => [`${new Date().getFullYear()}-01-01`, todayIso()]],
  ['Last year', () => { const y = new Date().getFullYear() - 1; return [`${y}-01-01`, `${y}-12-31`] }],
  ['All time', () => ['', '']],
]

const PAGE_SIZE = 10

export function DashboardPanel() {
  const [all, setAll] = useState(null)
  const [error, setError] = useState(null)
  const [[from, to], setRange] = useState(PRESETS[2][1]())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'cacCollected', dir: 'desc' })
  const [cert, setCert] = useState('ALL')
  const [page, setPage] = useState(0)
  const groups = cert === 'ALL' ? GROUPS : GROUPS.filter((g) => g.id === cert)
  const columns = groups.flatMap((g) => g.columns)

  function pickCert(id) {
    setCert(id)
    // Keep sorting on a column that is still shown.
    const shown = (id === 'ALL' ? GROUPS : GROUPS.filter((g) => g.id === id)).flatMap((g) => g.columns.map(([k]) => k))
    setSort((s) => (s.key === 'client' || s.key === 'rrCount' || shown.includes(s.key) ? s : { key: shown[0], dir: 'desc' }))
  }

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setError(null)
    getAllRrSummaries()
      .then(setAll)
      .catch((err) => setError(err.message || 'Could not load the Receiving Reports.'))
  }, [attempt])

  const inPeriod = useMemo(
    () => (all || []).filter((s) => (!from || (s.receivedDateIso && s.receivedDateIso >= from)) && (!to || (s.receivedDateIso && s.receivedDateIso <= to))),
    [all, from, to],
  )

  const rows = useMemo(() => {
    const byClient = new Map()
    for (const s of inPeriod) {
      const name = (s.accountName || s.companyName || 'Unnamed client').trim()
      const key = name.toLowerCase()
      if (!byClient.has(key)) byClient.set(key, { client: name, summaries: [] })
      byClient.get(key).summaries.push(s)
    }
    const q = search.trim().toLowerCase()
    const list = [...byClient.values()]
      .filter((c) => !q || c.client.toLowerCase().includes(q))
      .map((c) => {
        const dates = c.summaries.map((s) => s.receivedDateIso).filter(Boolean).sort()
        return { client: c.client, rrCount: c.summaries.length, firstRr: dates[0], lastRr: dates[dates.length - 1], summaries: c.summaries, ...figuresFor(c.summaries) }
      })
    const dir = sort.dir === 'asc' ? 1 : -1
    list.sort((a, b) => (sort.key === 'client' ? a.client.localeCompare(b.client) * dir : ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)) * dir))
    // Rank = place in the current sort order (e.g. #1 = most kg collected).
    return list.map((r, i) => ({ ...r, rank: i + 1 }))
  }, [inPeriod, search, sort])

  // 10 clients per page; back to page 1 whenever the list changes.
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const [pageFor, setPageFor] = useState(rows)
  if (pageFor !== rows) {
    setPageFor(rows)
    setPage(0)
  }
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const totals = useMemo(() => figuresFor(rows.flatMap((r) => r.summaries)), [rows])
  const totalRrs = rows.reduce((s, r) => s + r.rrCount, 0)
  const uncoveredKg = rows.flatMap((r) => r.summaries).reduce((s, r) => s + (r.totalNetWeight - r.materialsMatchedNetWeight), 0)

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'client' ? 'asc' : 'desc' }))
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Rank', 'Client', 'RRs', ...groups.flatMap((g) => g.columns.map(([, label]) => `${g.title} - ${label}`))]
    const line = (r, name) => [r.rank ?? '', name, r.rrCount, ...columns.map(([key, , , dec]) => (r[key] ?? 0).toFixed(dec))]
    const csv = [header, ...rows.map((r) => line(r, r.client)), line({ ...totals, rrCount: totalRrs }, 'TOTAL')].map((r) => r.map(esc).join(',')).join('\n')
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${exportName}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportName = `ESG Certificate Summary by Client${cert === 'ALL' ? '' : ` - ${cert}`} (${from || 'all'} to ${to || 'today'})`
  const [exportingXlsx, setExportingXlsx] = useState(false)

  /** Same table as the CSV, as a formatted Excel workbook (group headers, number formats, bold total, frozen header). */
  async function exportExcel() {
    setExportingXlsx(true)
    try {
      const { default: ExcelJS } = await import('exceljs') // loaded only when exporting
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Summary by Client', { views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }] })
      const lastCol = 3 + columns.length

      ws.mergeCells(1, 1, 1, lastCol)
      ws.getCell(1, 1).value = `ESG Certificate Summary by Client — RRs received ${from || 'from the start'} to ${to || 'today'}${search ? ` · client search "${search}"` : ''}`
      ws.getCell(1, 1).font = { bold: true, size: 13, color: { argb: 'FF006838' } }

      // Row 3: certificate group headers over their columns; row 4: column headers.
      let col = 4
      for (const g of groups) {
        ws.mergeCells(3, col, 3, col + g.columns.length - 1)
        const cell = ws.getCell(3, col)
        cell.value = g.title
        cell.alignment = { horizontal: 'center' }
        cell.font = { bold: true, color: { argb: 'FF006838' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EC' } }
        col += g.columns.length
      }
      const header = ws.getRow(4)
      header.values = ['Rank', 'Client', 'RRs', ...columns.map(([, label]) => label)]
      header.font = { bold: true }
      header.alignment = { wrapText: true, vertical: 'bottom' }
      header.height = 32

      for (const r of rows) ws.addRow([r.rank, r.client, r.rrCount, ...columns.map(([key, , , dec]) => Number((r[key] ?? 0).toFixed(dec)))])
      const total = ws.addRow(['', `Total (all ${rows.length})`, totalRrs, ...columns.map(([key, , , dec]) => Number((totals[key] ?? 0).toFixed(dec)))])
      total.font = { bold: true, color: { argb: 'FF006838' } }
      total.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EC' } }
        cell.border = { top: { style: 'thin', color: { argb: 'FF006838' } } }
      })

      ws.getColumn(1).width = 6
      ws.getColumn(2).width = 42
      ws.getColumn(3).width = 7
      columns.forEach(([, , , dec], i) => {
        const c = ws.getColumn(4 + i)
        c.width = 16
        c.numFmt = dec === 0 ? '#,##0' : '#,##0.00'
      })
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastCol } }

      const buffer = await wb.xlsx.writeBuffer()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      a.download = `${exportName}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExportingXlsx(false)
    }
  }

  const th = 'px-1.5 py-2 align-bottom text-[10px] font-semibold uppercase leading-tight tracking-wide text-gray-500 cursor-pointer select-none hover:text-brand-green-dark'
  const arrow = (key) => (sort.key === key ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : '')

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Certificate Summary by Client"
        subtitle="What the Environmental Impact, Carbon Abatement and Landfill Diversion certificates add up to per client, for every RR received in the period — the same figures a certificate for that client and period would print."
      >
        <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
          <FormField label="Certificate">
            <select value={cert} onChange={(e) => pickCert(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/20">
              <option value="ALL">All 3 certificates</option>
              {GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Received from">
            <TextInput type="date" value={from} onChange={(e) => setRange([e.target.value, to])} />
          </FormField>
          <FormField label="Received to">
            <TextInput type="date" value={to} onChange={(e) => setRange([from, e.target.value])} />
          </FormField>
          <FormField label="Search client">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Client / account name" />
          </FormField>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map(([label, range]) => (
            <GhostButton key={label} type="button" onClick={() => setRange(range())}>
              {label}
            </GhostButton>
          ))}
          <div className="flex-1" />
          <GhostButton type="button" onClick={exportCsv} disabled={!rows.length}>
            ⬇ Export CSV
          </GhostButton>
          <GhostButton type="button" onClick={exportExcel} disabled={!rows.length || exportingXlsx}>
            {exportingXlsx ? 'Preparing Excel…' : '⬇ Export Excel'}
          </GhostButton>
        </div>
      </Card>

      <Card
        title={all ? `${rows.length} client(s) · ${totalRrs} RR(s)` : 'Loading Receiving Reports…'}
        subtitle={
          all
            ? `Period: ${from || 'all RRs'} to ${to || 'today'}. Click a column to sort — # is the rank in that order.${uncoveredKg > 0.005 ? ` Carbon/plastic figures only cover item types in the material split catalog (${formatNumber(uncoveredKg)} kg of the weight isn't in it).` : ''}`
            : undefined
        }
      >
        {error && (
          <div className="flex items-center gap-3 text-sm text-red-600">
            Couldn't load the Receiving Reports ({error}).
            <GhostButton type="button" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </GhostButton>
          </div>
        )}
        {!all && !error && <p className="py-10 text-center text-sm text-gray-400">Loading…</p>}
        {all && (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-100">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="border-b border-gray-100" colSpan={3} />
                  {groups.map((g) => (
                    <th key={g.title} colSpan={g.columns.length} className={`border-b border-l border-gray-100 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide ${g.color}`}>
                      {g.title}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 text-left">
                  <th className={`${th} w-8 cursor-default text-right hover:text-gray-500`} title="Rank in the current sort order">#</th>
                  <th className={`${th} w-[16%] text-left`} onClick={() => toggleSort('client')}>Client{arrow('client')}</th>
                  <th className={`${th} text-right`} onClick={() => toggleSort('rrCount')}>RRs{arrow('rrCount')}</th>
                  {groups.map((g) =>
                    g.columns.map(([key, label], i) => (
                      <th key={key} className={`${th} text-right ${i === 0 ? 'border-l border-gray-100' : ''}`} onClick={() => toggleSort(key)}>
                        {label}
                        {arrow(key)}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3 + columns.length} className="py-10 text-center text-sm text-gray-400">
                      No RRs received in this period{search ? ' for that client' : ''}.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={r.client} className="border-b border-gray-50 hover:bg-gray-50/70">
                    <td className="px-1.5 py-1.5 text-right align-top font-bold tabular-nums text-brand-green-dark">{r.rank}</td>
                    <td className="px-1.5 py-1.5 font-medium leading-snug text-gray-800">
                      {r.client}
                      <div className="text-[10px] font-normal text-gray-400">
                        {r.firstRr === r.lastRr ? r.firstRr : `${r.firstRr} – ${r.lastRr}`}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-right text-gray-600">{r.rrCount}</td>
                    {groups.map((g) =>
                      g.columns.map(([key, , , dec], i) => (
                        <td key={key} className={`whitespace-nowrap px-1.5 py-1.5 text-right tabular-nums text-gray-700 ${i === 0 ? 'border-l border-gray-100' : ''}`}>
                          {formatNumber(r[key], dec)}
                        </td>
                      )),
                    )}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0 bg-brand-green-light">
                  <tr className="font-semibold text-brand-green-dark">
                    <td className="px-1.5 py-2" />
                    <td className="px-1.5 py-2">Total (all {rows.length})</td>
                    <td className="px-1.5 py-2 text-right">{totalRrs}</td>
                    {groups.map((g) =>
                      g.columns.map(([key, , , dec], i) => (
                        <td key={key} className={`whitespace-nowrap px-1.5 py-2 text-right tabular-nums ${i === 0 ? 'border-l border-brand-green/10' : ''}`}>
                          {formatNumber(totals[key], dec)}
                        </td>
                      )),
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {all && rows.length > PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>
              Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of {rows.length} clients
            </span>
            <div className="flex items-center gap-2">
              <GhostButton type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>
                ‹ Prev
              </GhostButton>
              <span className="tabular-nums">
                Page {currentPage + 1} of {pageCount}
              </span>
              <GhostButton type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
                Next ›
              </GhostButton>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
