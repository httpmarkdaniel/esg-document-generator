// Every piece of free text printed in the ESG report, with its default
// (auto-generated) value — the report's counterpart of
// certificate/certificateText.js. The template prints ONLY what
// resolveReportText returns: an override replaces the default, an empty
// string removes that line (and its spacing), a missing key uses the default.
// The data tables themselves (Table 1 / Table 2) come straight from the rows
// and aren't edited here.
//
// Overrides on data-derived text (client block, dates, every figure) are
// cleared whenever new RR / calculator data is added — see
// withoutReportDataOverrides — so a hand-typed number can't outlive a data change.

import { formatKg, formatUnit, formatNumber, toText } from '../lib/format.js'
import { COMPANY, SIGNATORIES } from '../lib/brand.js'
import {
  introductionParagraphs,
  REFURBISH_REUSE_DESCRIPTION,
  RECYCLED_MATERIALS_DESCRIPTION,
  METHODOLOGY_SECTIONS,
  CONCLUSION_PARAGRAPHS,
} from './methodology.js'

const ROLE_LABELS = ['Prepared by:', 'Reviewed by:', 'Approved by:']

/** The ordered list of editable text fields for this report, with default values. */
export function reportTextFields(data) {
  const { report, client, collectionDateRange, reportIssueDateLabel, totals, equivalencies } = data
  const clientName = toText(client.name)
  const f = (section, key, label, value, multiline = false) => ({ section, key, label, value, multiline })

  return [
    f('Header', 'title', 'Title', toText(report.title, 'Carbon Abatement Report')),
    f('Header', 'clientLabel', '"Client:" label', 'Client:'),
    f('Header', 'clientName', 'Client name', clientName),
    f('Header', 'clientAddress1', 'Client address', client.addressLine1 !== '—' ? client.addressLine1 : ''),
    f('Header', 'clientCity', 'Client city / country', client.cityStateZipCountry !== '—' ? client.cityStateZipCountry : ''),
    f('Header', 'preparedLabel', '"Prepared by:" label', 'Prepared by:'),
    f('Header', 'preparedName', 'Prepared by — company', COMPANY.name),
    f('Header', 'preparedAddress', 'Prepared by — address', COMPANY.addressLine),
    f('Header', 'periodLabel', '"Reporting Period:" label', 'Reporting Period:'),
    f('Header', 'itemsCollected', 'Items collected line', `Items collected: ${toText(collectionDateRange, '—')}`),
    f('Header', 'reportIssued', 'Report issued line', `Report issued: ${reportIssueDateLabel}`),

    f('1. Introduction', 'h1', 'Heading', '1. Introduction'),
    ...introductionParagraphs(clientName).map((p, i) => f('1. Introduction', `intro${i}`, `Paragraph ${i + 1}`, p, true)),

    f('2. Impact Breakdown', 'h2', 'Heading', '2. Detailed Impact Breakdown'),
    f('2. Impact Breakdown', 'h21', '2.1 heading', '2.1 Refurbish/Re-use of Materials'),
    f('2. Impact Breakdown', 'p21', '2.1 paragraph', REFURBISH_REUSE_DESCRIPTION, true),
    f('2. Impact Breakdown', 'table1Caption', 'Table 1 caption', 'Table 1. Summary of Detailed Impact Breakdown for Refurbish/Re-use of Materials', true),
    f('2. Impact Breakdown', 'h22', '2.2 heading', '2.2 Subtotal Impact for Refurbished Equipment'),
    ...[
      `Total Material Processed: ${formatKg(totals.materialsTotalKg)}`,
      `Total Carbon Footprint: ${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')}`,
      `Recycled Emissions: ${formatUnit(totals.recycledEmissionsKgCO2e, 'kg CO2e')}`,
      `Net Carbon Abated: ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}`,
      `Water Saved: ${formatUnit(totals.waterSavedLiters, 'liters', 0)}`,
      `Energy Saved: ${formatUnit(totals.energySavedKwh, 'kWh')}`,
      `Landfill Averted: ${formatKg(totals.landfillAvertedKg)}`,
    ].map((text, i) => f('2. Impact Breakdown', `b22_${i}`, `2.2 bullet ${i + 1}`, text)),

    f('3. Recycled Materials', 'h3', 'Heading', '3. Recycled Materials'),
    f('3. Recycled Materials', 'p3', 'Paragraph', RECYCLED_MATERIALS_DESCRIPTION, true),
    f('3. Recycled Materials', 'table2Caption', 'Table 2 caption', 'Table 2. Summary of Materials Recovered'),

    f('4. Methodology', 'h4', 'Heading', '4. Methodology'),
    ...METHODOLOGY_SECTIONS.flatMap((s, i) => [
      f('4. Methodology', `m${i}Heading`, `${s.heading.split(' ')[0]} heading`, s.heading),
      f('4. Methodology', `m${i}Body`, `${s.heading.split(' ')[0]} paragraph`, s.body(clientName), true),
    ]),

    f('5. Environmental Impact', 'h5', 'Heading', '5. Environmental Impact'),
    f('5. Environmental Impact', 'p5', 'Intro line', 'The recycling of the listed assets will result in the following environmental benefits:', true),
    f('5. Environmental Impact', 'h51', '5.1 heading', '5.1 Carbon Benefits:'),
    f('5. Environmental Impact', 'b51_0', '5.1 bullet 1', `${formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e')} of embodied carbon avoided through recycling.`, true),
    f(
      '5. Environmental Impact',
      'b51_1',
      '5.1 bullet 2',
      `After accounting for ${formatUnit(totals.recycledEmissionsKgCO2e, 'CO2e')} of recycling-related emissions, the net carbon abatement achieved is ${formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e')}.`,
      true,
    ),
    f('5. Environmental Impact', 'b51_2', '5.1 bullet 3', `Equivalent to eliminating emissions from ${formatNumber(equivalencies.kmAvoided, 0)} km of passenger-car travel.`, true),
    f('5. Environmental Impact', 'h52', '5.2 heading', '5.2 Water Saved:'),
    f('5. Environmental Impact', 'b52_0', '5.2 bullet 1', `${formatUnit(totals.waterSavedLiters, 'liters', 0)} of fresh water saved.`),
    f('5. Environmental Impact', 'b52_1', '5.2 bullet 2', `Equivalent to ${formatNumber(equivalencies.olympicPools, 1)} Olympic-sized swimming pools (1 pool ~ 2.5M liters).`, true),
    f('5. Environmental Impact', 'h53', '5.3 heading', '5.3 Energy Saved:'),
    f('5. Environmental Impact', 'b53_0', '5.3 bullet 1', `${formatUnit(totals.energySavedKwh, 'kWh')} of energy conserved.`),
    f(
      '5. Environmental Impact',
      'b53_1',
      '5.3 bullet 2',
      `Equivalent to powering ${formatNumber(equivalencies.householdYears, 1)} average Philippine household-years (~ 9,000 kWh).`,
      true,
    ),
    f('5. Environmental Impact', 'h54', '5.4 heading', '5.4 Waste Diversion:'),
    f('5. Environmental Impact', 'b54_0', '5.4 bullet 1', `${formatKg(totals.landfillAvertedKg)} of electronic waste diverted from landfill.`),
    f('5. Environmental Impact', 'b54_1', '5.4 bullet 2', `Equivalent to ${formatNumber(equivalencies.carWeights, 1)} of an average car's weight (~ 3,000 kg).`, true),

    f('6. Conclusion', 'h6', 'Heading', '6. Conclusion'),
    ...CONCLUSION_PARAGRAPHS.map((p, i) => f('6. Conclusion', `concl${i}`, `Paragraph ${i + 1}`, p, true)),

    ...SIGNATORIES.flatMap((sig, i) => [
      f('Signatories', `role${i}`, `Signatory ${i + 1} role`, ROLE_LABELS[i] || ''),
      f('Signatories', `sig${i}Name`, `Signatory ${i + 1} name`, sig.name),
      f('Signatories', `sig${i}Title`, `Signatory ${i + 1} title`, sig.title, true),
    ]),
  ]
}

/** key -> final text (override if set, else the default). */
export function resolveReportText(data) {
  const overrides = data.textOverrides || {}
  const text = {}
  for (const field of reportTextFields(data)) text[field.key] = field.key in overrides ? overrides[field.key] : field.value
  return text
}

// Text that depends on the loaded rows/client: the client block, the dates,
// every bullet with a figure, and the paragraphs that name the client.
const DATA_DEPENDENT_KEY = /^(clientName|clientAddress1|clientCity|itemsCollected|reportIssued|intro0|m0Body)$|^b\d+_\d+$/

/** Drop the overrides that depend on the loaded data, keeping edited wording and removed/moved images. */
export function withoutReportDataOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => !DATA_DEPENDENT_KEY.test(key)))
}
