// Every piece of free text printed in the ESG report, with its default
// (auto-generated) value — the report's counterpart of
// certificate/certificateText.js. The template prints ONLY what
// resolveReportText returns: an override replaces the default, an empty
// string removes that line (and its spacing), a missing key uses the default.
// `**text**` prints bold (see richText.js), matching the reference's bold
// figures and labels. The data tables themselves (Table 1 / Table 2) come
// straight from the rows and aren't edited here.
//
// Overrides on data-derived text (client block, dates, every figure) are
// cleared whenever new RR / calculator data is added — see
// withoutReportDataOverrides — so a hand-typed number can't outlive a data change.

import { formatKg, formatUnit, formatNumber, toText } from '../lib/format.js'
import { COMPANY, SIGNATORIES } from '../lib/brand.js'
import { METHODOLOGY_SECTIONS, CONCLUSION_PARAGRAPHS, REFURBISH_REUSE_DESCRIPTION, RECYCLED_MATERIALS_DESCRIPTION, FORM_CODE, FORM_EFFECTIVE_DATE } from './methodology.js'

const ROLE_LABELS = ['Prepared by:', 'Reviewed by:', 'Approved by:']

const blankToEmpty = (v) => (v && v !== '—' ? v : '')

/** The ordered list of editable text fields for this report, with default values. */
export function reportTextFields(data) {
  const { report, client, collectionDateRange, reportIssueDateLabel, totals, equivalencies } = data
  const clientName = toText(client.name)
  const f = (section, key, label, value, multiline = false) => ({ section, key, label, value, multiline })
  const b = (v) => `**${v}**`

  return [
    f('Letterhead', 'lhAddress', 'Company / address line', `${COMPANY.name.replace(/\.$/, '').toUpperCase()}. | ${COMPANY.letterheadAddressLine}`, true),
    f('Letterhead', 'lhPhone', 'Phone', COMPANY.phone),
    f('Letterhead', 'lhEmail', 'Email', COMPANY.email),
    f('Letterhead', 'lhWebsite', 'Website', COMPANY.website),

    f('Header', 'title', 'Title', toText(report.title, 'Carbon Abatement Report')),
    f('Header', 'clientLabel', '"Client:" label', 'Client:'),
    f('Header', 'clientName', 'Client name', clientName),
    f('Header', 'clientAddress1', 'Client address line 1', blankToEmpty(client.addressLine1)),
    f('Header', 'clientAddress2', 'Client address line 2', blankToEmpty(client.addressLine2)),
    f('Header', 'clientCity', 'Client city / country', blankToEmpty(client.cityStateZipCountry)),
    f('Header', 'preparedLabel', '"Prepared by:" label', 'Prepared by:'),
    f('Header', 'preparedName', 'Prepared by — company', COMPANY.name),
    f('Header', 'preparedAddress', 'Prepared by — address', COMPANY.addressLine),
    f('Header', 'periodLabel', '"Reporting Period:" label', 'Reporting Period:'),
    f('Header', 'itemsCollected', 'Items collected line', `Items collected: ${toText(collectionDateRange, '—')}`),
    f('Header', 'reportIssued', 'Report issued line', `Report issued: ${reportIssueDateLabel}`),

    f('1. Introduction', 'h1', 'Heading', '1. Introduction'),
    f('1. Introduction', 'intro0', 'Paragraph 1', `This report highlights the environmental benefits of electronic recyclables collected from ${b(clientName)}${/\.$/.test(clientName) ? '' : '.'}`, true),
    f(
      '1. Introduction',
      'intro1',
      'Paragraph 2',
      'All listed materials were processed in accordance with applicable environmental, health, and safety requirements, including recognized industry and management system standards such as **ISO** and **SERI’s R2v3**. Material recovery and downstream recycling activities were conducted in alignment with relevant global, regional, and local environmental standards.',
      true,
    ),
    f(
      '1. Introduction',
      'intro2',
      'Paragraph 3',
      'The purpose of this report is to quantify the positive environmental impact achieved through responsible electronics recovery, including carbon emissions avoided, water conserved, energy saved, and waste diverted from landfill.',
      true,
    ),

    f('2. Impact Breakdown', 'h2', 'Heading', '2. Detailed Impact Breakdown'),
    f('2. Impact Breakdown', 'h21', '2.1 heading', '2.1 Refurbish/Re-use of Materials'),
    f('2. Impact Breakdown', 'p21', '2.1 description', `**Description:** ${REFURBISH_REUSE_DESCRIPTION}`, true),
    f('2. Impact Breakdown', 'table1Caption', 'Table 1 caption', '**Table 1.** Summary of Detailed Impact Breakdown for Refurbish/Re-use of Materials', true),
    f('2. Impact Breakdown', 'h22', '2.2 heading', '2.2 Subtotal Impact for Refurbished Equipment:'),
    ...[
      `Total Material Processed: ${b(formatKg(totals.materialsTotalKg))}`,
      `Total Carbon Footprint: ${b(formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e'))}`,
      `Recycled Emissions: ${b(formatUnit(totals.recycledEmissionsKgCO2e, 'kg CO2e'))}`,
      `Net Carbon Abated: ${b(formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e'))}`,
      `Water Saved: ${b(formatUnit(totals.waterSavedLiters, 'liters', 0))}`,
      `Energy Saved: ${b(formatUnit(totals.energySavedKwh, 'kWh'))}`,
      `Landfill Averted: ${b(formatKg(totals.landfillAvertedKg))}`,
    ].map((text, i) => f('2. Impact Breakdown', `b22_${i}`, `2.2 bullet ${i + 1}`, text)),

    f('3. Recycled Materials', 'h3', 'Heading', '3. Recycled Materials'),
    f('3. Recycled Materials', 'p3', 'Description', `**Description:** ${RECYCLED_MATERIALS_DESCRIPTION}`, true),
    f('3. Recycled Materials', 'table2Caption', 'Table 2 caption', '**Table 2.** Summary of Materials Recovered'),

    f('4. Methodology', 'h4', 'Heading', '4. Methodology'),
    ...METHODOLOGY_SECTIONS.flatMap((s, i) => {
      const num = s.heading.split(' ')[0]
      const body = i === 0 ? s.body(clientName).replace(clientName, b(clientName)) : s.body(clientName)
      return [f('4. Methodology', `m${i}Heading`, `${num} heading`, `${s.heading}:`), f('4. Methodology', `m${i}Body`, `${num} text`, body, true)]
    }),

    f('5. Environmental Impact', 'h5', 'Heading', '5. Environmental Impact'),
    f('5. Environmental Impact', 'p5', 'Intro line', 'The recycling of the listed assets will result in the following environmental benefits:', true),
    f('5. Environmental Impact', 'h51', '5.1 heading', '5.1 Carbon Benefits:'),
    f('5. Environmental Impact', 'b51_0', '5.1 bullet 1', `${b(formatUnit(totals.carbonFootprintKgCO2e, 'kg CO2e'))} of embodied carbon avoided through recycling.`, true),
    f(
      '5. Environmental Impact',
      'b51_1',
      '5.1 bullet 2',
      `After accounting for ${formatUnit(totals.recycledEmissionsKgCO2e, 'CO2e')} of recycling-related emissions, the net carbon abatement achieved is ${b(formatUnit(totals.netCarbonAbatedKgCO2e, 'kg CO2e'))}.`,
      true,
    ),
    f('5. Environmental Impact', 'b51_2', '5.1 bullet 3', `Equivalent to eliminating emissions from ${b(`${formatNumber(equivalencies.kmAvoided, 0)} km`)} of passenger-car travel.`, true),
    f('5. Environmental Impact', 'h52', '5.2 heading', '5.2 Water Saved:'),
    f('5. Environmental Impact', 'b52_0', '5.2 bullet 1', `${b(formatUnit(totals.waterSavedLiters, 'liters', 0))} of fresh water saved.`),
    f('5. Environmental Impact', 'b52_1', '5.2 bullet 2', `Equivalent to ${b(`${formatNumber(equivalencies.olympicPools, 1)} Olympic-sized swimming pools`)} (1 pool ≈ 2.5M liters).`, true),
    f('5. Environmental Impact', 'h53', '5.3 heading', '5.3 Energy Saved:'),
    f('5. Environmental Impact', 'b53_0', '5.3 bullet 1', `${b(formatUnit(totals.energySavedKwh, 'kWh'))} of energy conserved.`),
    f(
      '5. Environmental Impact',
      'b53_1',
      '5.3 bullet 2',
      `Equivalent to powering ${b(`${formatNumber(equivalencies.householdYears, 1)} average Philippine household-years`)} (≈ 9,000 kWh).`,
      true,
    ),
    f('5. Environmental Impact', 'h54', '5.4 heading', '5.4 Waste Diversion:'),
    f('5. Environmental Impact', 'b54_0', '5.4 bullet 1', `${b(formatKg(totals.landfillAvertedKg))} of electronic waste diverted from landfill.`),
    f('5. Environmental Impact', 'b54_1', '5.4 bullet 2', `Equivalent to ${b(`${formatNumber(equivalencies.carWeights, 1)} of an average car’s weight`)} (≈ 3,000 kg).`, true),

    f('6. Conclusion', 'h6', 'Heading', '6. Conclusion'),
    ...CONCLUSION_PARAGRAPHS.map((p, i) => f('6. Conclusion', `concl${i}`, `Paragraph ${i + 1}`, p, true)),

    ...SIGNATORIES.flatMap((sig, i) => [
      f('Signatories', `role${i}`, `Signatory ${i + 1} role`, ROLE_LABELS[i] || ''),
      f('Signatories', `sig${i}Name`, `Signatory ${i + 1} name`, sig.name),
      f('Signatories', `sig${i}Title`, `Signatory ${i + 1} title`, sig.title),
    ]),

    f('Footer (every page)', 'formCode', 'Form code', FORM_CODE),
    f('Footer (every page)', 'formEffective', 'Effective date', FORM_EFFECTIVE_DATE),
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
const DATA_DEPENDENT_KEY = /^(clientName|clientAddress1|clientAddress2|clientCity|itemsCollected|reportIssued|intro0|m0Body)$|^b\d+_\d+$/

/** Drop the overrides that depend on the loaded data, keeping edited wording and removed/moved images. */
export function withoutReportDataOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => !DATA_DEPENDENT_KEY.test(key)))
}
