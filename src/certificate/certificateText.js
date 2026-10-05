// Every piece of text printed on a certificate, per type, with its default
// (auto-generated) value. The template draws ONLY what resolveCertificateText
// returns, so the preview editor can override any line: a string replaces
// the default, an empty string hides that text, and a missing key falls
// back to the default.
//
// Overrides on data-derived text (stat values, the recipient block) are
// cleared whenever new RR / calculator data is loaded — see
// withoutDataOverrides — so a hand-typed figure can't silently survive a
// data change.

import { formatNumber, toText } from '../lib/format.js'
import { COMPANY, SIGNATORIES, CERTIFICATE_TYPES, CERTIFICATE_DISCLAIMER, MATERIAL_BENEFIT_TEXT } from '../lib/brand.js'

// CAC/LDC follow the current EnviroCycle (Canva) certificates, whose
// disclaimer bolds the standards' names — **…** marks the bold parts.
const CERTIFICATE_DISCLAIMER_RICH = {
  CAC: 'Calculated in accordance with the **GHG Protocol** and **ISO 14064** (where applicable); processing aligned with **R2v3**. Carbon abatement is estimated using an avoided-virgin material approach referencing **EPA WARM** and WEEE lifecycle sources; distance equivalency assumes 0.25 kg CO₂e per km.',
  LDC: 'Calculated in accordance with the **GHG Protocol** and **ISO 14064** (where applicable); processing aligned with **R2v3**. Diversion and savings estimates support the **Zero Waste to Landfill** goal and apply an avoided-virgin material approach using EPA WARM and WEEE lifecycle references.',
}

// The Landfill Diversion Certificate's "Recycled Materials Summary" rows.
// Whole Equipment (units kept whole, not broken down) has no data source yet,
// so it's always listed and its amount is typed in the editor.
export const LDC_TABLE_ROWS = ['Whole Equipment', 'Metal', 'Plastic', 'Glass', 'Electronics']
const LDC_BENEFIT_TEXT = {
  ...MATERIAL_BENEFIT_TEXT,
  'Whole Equipment': 'Extends equipment life and reduces premature disposal.',
  Glass: 'Saves furnace energy and raw mineral extraction.',
}

/** "Whole Equipment" -> "rowWholeEquipment", the prefix of that table row's text keys. */
export function ldcRowKey(material) {
  return `row${material.replace(/\s+/g, '')}`
}

function headerFields(data, type) {
  return [
    { key: 'certificateNo', section: 'Header', label: 'Certificate No. line', value: `Certificate No. ${toText(data.certificateNumber)}` },
    { key: 'title', section: 'Header', label: 'Title', value: CERTIFICATE_TYPES[type].title },
    { key: 'issuedTo', section: 'Header', label: '"Is issued to" line', value: 'IS ISSUED TO :' },
    { key: 'recipient', section: 'Recipient', label: 'Recipient', value: toText(data.recipient) },
    { key: 'address', section: 'Recipient', label: 'Address', value: data.companyAddress && data.companyAddress !== '—' ? data.companyAddress : '' },
    ...collectionFields(data, type),
  ]
}

/** The italic line(s) under the address: RR no. + collection date (EIC/LDC), collection date (CAC), or the reporting period (RPC). */
function collectionFields(data, type) {
  const itemsCollected = { key: 'itemsCollected', section: 'Recipient', label: '"Items collected" line', value: `Items collected ${data.itemsCollectedLabel}` }
  switch (type) {
    case 'RPC':
      return [{ key: 'period', section: 'Recipient', label: 'Reporting period line', value: `Reporting Period: ${data.reportingPeriodLabel}` }]
    case 'CAC':
      return [itemsCollected]
    default:
      return [
        { key: 'receivingReport', section: 'Recipient', label: 'Receiving Report line', value: data.receivingReport ? `Receiving Report: ${data.receivingReport}` : '' },
        itemsCollected,
      ]
  }
}

function footerFields(data, type) {
  return [
    { key: 'givenLine', section: 'Footer', label: '"Given this day" line', value: `Given this day, ${data.givenDateLabel}, at ${COMPANY.name}` },
    { key: 'companyAddress', section: 'Footer', label: 'Company address', value: COMPANY.addressLine },
    ...SIGNATORIES.flatMap((sig, i) => [
      { key: `sig${i}Name`, section: 'Signatories', label: `Signatory ${i + 1} name`, value: sig.name },
      { key: `sig${i}Title`, section: 'Signatories', label: `Signatory ${i + 1} title`, value: sig.title },
    ]),
    {
      key: 'disclaimer',
      section: 'Footer',
      label: 'Disclaimer',
      value: CERTIFICATE_DISCLAIMER_RICH[type] || CERTIFICATE_DISCLAIMER[type] || CERTIFICATE_DISCLAIMER.EIC,
      multiline: true,
    },
  ]
}

/** A stat tile's label + value, as two editable fields. */
function tileFields(section, prefix, label, value) {
  return [
    { key: `${prefix}Label`, section, label: `${label} — label`, value: label },
    { key: `${prefix}Value`, section, label: `${label} — value`, value, multiline: true },
  ]
}

function bodyFields(data, type) {
  switch (type) {
    case 'CAC':
      return [
        {
          key: 'basis',
          section: 'Body',
          label: 'Basis line',
          value: 'Basis: Net carbon abated = avoided virgin production emissions − recycled processing emissions',
          multiline: true,
        },
        ...tileFields('Stats', 'collected', 'Materials Recycled', `${formatNumber(data.materialsCollectedKg)} kg`),
        ...tileFields('Stats', 'footprint', 'Total Carbon Footprint', `${formatNumber(data.totalCarbonFootprintKgCO2e)} kg CO₂e`),
        ...tileFields('Stats', 'abated', 'Net Carbon Abated (Carbon Saved)', `~${formatNumber(data.netCarbonAbatedKgCO2e)} kg CO₂e`),
        ...tileFields('Stats', 'recycledEmissions', 'Recycled Emissions', `${formatNumber(data.recycledEmissionsKgCO2e)} kg CO₂e`),
        ...tileFields('Stats', 'km', 'Carbon Benefits Equivalent', `~${formatNumber(data.kmAvoided, 0)} km avoided`),
        { key: 'kmNote', section: 'Stats', label: 'Carbon Benefits Equivalent — note', value: '(0.25 kg CO₂e/km assumption)' },
      ]
    case 'LDC':
      return [
        { key: 'diversionHeading', section: 'Body', label: 'Left heading', value: 'MATERIAL DIVERSION SUMMARY' },
        { key: 'recycledHeading', section: 'Body', label: 'Right heading', value: 'RECYCLED MATERIALS SUMMARY' },
        ...tileFields('Stats', 'collected', 'Materials Collected', `${formatNumber(data.materialsCollectedKg)} kg`),
        ...tileFields('Stats', 'landfill', 'Landfill Diverted', `${formatNumber(data.landfillDivertedKg)} kg`),
        ...LDC_TABLE_ROWS.flatMap((m) => {
          const whole = m === 'Whole Equipment'
          const weight = whole ? 0 : data.materials[`${m.toLowerCase()}Kg`]
          // Material rows only exist when that material has weight.
          if (!whole && weight <= 0) return []
          const pct = data.materialsTotalKg > 0 ? (weight / data.materialsTotalKg) * 100 : 0
          const key = ldcRowKey(m)
          return [
            { key: `${key}Label`, section: 'Materials table', label: `${m} — name`, value: m },
            { key: `${key}Amount`, section: 'Materials table', label: `${m} — amount`, value: `${formatNumber(weight, 3)} kg (${formatNumber(pct, 2)}%)` },
            { key: `${key}Benefit`, section: 'Materials table', label: `${m} — benefit text`, value: LDC_BENEFIT_TEXT[m], multiline: true },
          ]
        }),
      ]
    case 'RPC':
      return [
        ...tileFields('Stats', 'received', 'TOTAL RECEIVED VOLUME', `${formatNumber(data.totalReceivedVolumeKg)}\nKG`),
        ...tileFields('Stats', 'plasticWaste', 'PLASTIC WASTE', `${formatNumber(data.plasticWasteKg)}\nKG`),
        ...tileFields('Stats', 'rigid', 'RIGID PLASTIC', `${formatNumber(data.rigidPlasticKg)}\nKG`),
        ...tileFields('Stats', 'flexible', 'FLEXIBLE PLASTIC', `${formatNumber(data.flexiblePlasticKg)}\nKG`),
      ]
    case 'EIC':
    default:
      return [
        { key: 'resultsTitle', section: 'Impact results panel', label: 'Panel title', value: 'ENVIRONMENTAL IMPACT RESULTS' },
        ...tileFields('Impact results panel', 'carbon', 'Carbon Saved', `${formatNumber(data.netCarbonAbatedKgCO2e)}\nkg CO2e`),
        ...tileFields('Impact results panel', 'landfill', 'Landfill Diverted', `${formatNumber(data.landfillDivertedKg)}\nkg`),
        ...tileFields('Impact results panel', 'plastic', 'Plastic Recycled', `${formatNumber(data.plasticRecycledKg)}\nkg`),
        { key: 'savingsTitle', section: 'Savings panel', label: 'Panel title', value: 'ENVIRONMENTAL SAVINGS' },
        // Savings tiles only appear when their value is above zero, same as before.
        ...(data.treesSaved > 0 ? tileFields('Savings panel', 'trees', 'Trees Saved', `${formatNumber(data.treesSaved, 0)}\nTrees`) : []),
        ...(data.waterSavedLiters > 0 ? tileFields('Savings panel', 'water', 'Water Saved', `${formatNumber(data.waterSavedLiters, 0)}\nL`) : []),
        ...(data.energySavedKwh > 0 ? tileFields('Savings panel', 'energy', 'Energy Saved', `${formatNumber(data.energySavedKwh)}\nkWh`) : []),
      ]
  }
}

/** The ordered list of editable text fields for this certificate's type, with default values. */
export function certificateTextFields(data) {
  const type = CERTIFICATE_TYPES[data.certificateType] ? data.certificateType : 'EIC'
  return [...headerFields(data, type), ...bodyFields(data, type), ...footerFields(data, type)]
}

/** key -> final text (override if set, else the default). Keys not on this type are absent. */
export function resolveCertificateText(data) {
  const overrides = data.textOverrides || {}
  const text = {}
  for (const f of certificateTextFields(data)) text[f.key] = f.key in overrides ? overrides[f.key] : f.value
  return text
}

// Overrides that depend on the loaded data: every stat value / table amount,
// plus the recipient block. Matched by key pattern so it also covers rows
// that don't exist on the current data (e.g. an LDC material now at 0 kg).
const DATA_DEPENDENT_KEY = /(Value|Amount)$|^(recipient|address|period|receivingReport|itemsCollected)$/

/** Drop the overrides that depend on the loaded data, keeping edited wording (titles, signatories, disclaimer…). */
export function withoutDataOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => !DATA_DEPENDENT_KEY.test(key)))
}
