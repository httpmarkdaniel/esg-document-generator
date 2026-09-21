// Fixed narrative text reproduced from the real "Carbon Abatement - Client
// Template.pdf". This is the company's actual methodology and boilerplate
// language, not user-editable free text — per instruction, the report must
// use the real methodology rather than invented claims.

export const REPORT_TITLE = 'Carbon Abatement Report'

export function introductionParagraphs(clientName) {
  return [
    `This report highlights the environmental benefits of electronic recyclables collected from ${clientName}.`,
    "All listed materials were processed in accordance with applicable environmental, health, and safety requirements, including recognized industry and management system standards such as ISO and SERI's R2v3. Material recovery and downstream recycling activities were conducted in alignment with relevant global, regional, and local environmental standards.",
    'The purpose of this report is to quantify the positive environmental impact achieved through responsible electronics recovery, including carbon emissions avoided, water conserved, energy saved, and waste diverted from landfill.',
  ]
}

export const REFURBISH_REUSE_DESCRIPTION =
  'Refurbishment and reuse extend the useful life of equipment and components, helping reduce the need for new manufacturing and the extraction of virgin materials.'

export const RECYCLED_MATERIALS_DESCRIPTION =
  'Recycling reduces emissions, water, and energy use compared to extracting and processing virgin materials.'

export const METHODOLOGY_SECTIONS = [
  {
    heading: '4.1 Data Collection',
    body: (clientName) =>
      `Assets received from ${clientName} were inventoried by type, weight, and material composition. Items were categorized into metal, plastic, glass, and electronic components for impact estimation.`,
  },
  {
    heading: '4.2 Lifecycle Data Sources',
    body: () => 'Emissions, water, and energy estimates are based on EU JRC (WEEE), EPA WARM, UNU guidelines, and OEM teardown data.',
  },
  {
    heading: '4.3 Calculation Approach',
    body: () => 'Recycling avoided emissions from virgin material production. Water, energy, and landfill multipliers sourced from EPA WARM and industry LCAs.',
  },
  {
    heading: '4.4 Standards Followed',
    body: () => 'GHG Protocol, ISO 14064/14067',
  },
]

export const CONCLUSION_PARAGRAPHS = [
  'The recycling of these assets yields a significant environmental benefit, including reduced carbon emissions, energy and water conservation, and substantial landfill diversion. All figures are based on global averages for asset weights and material CO2 factors, as outlined in the Greenhouse Gas Protocol.',
  'For any questions or further clarifications, please feel free to contact us.',
]

export const FORM_CODE = 'EPI FORM-DCC 4237 Rev 02'
export const FORM_EFFECTIVE_DATE = 'Effective Date: 25-Nov-25'
