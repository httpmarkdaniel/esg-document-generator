// Shared brand constants for all certificate types, sourced from the real
// "Template ESG Certificates.pdf". Centralized here so a future swap of the
// real logo image / exact colors / signatories only touches this file.

export const COMPANY = {
  name: 'Envirocycle Philippines Inc.',
  addressLine: 'CA Yulo Ave, Silangan Industrial Park, Canlubang, Calamba City, Laguna',
  // Full letterhead form used on the report (matches the reference exactly).
  letterheadAddressLine: 'CA Yulo Avenue, Silangan Industrial Park, Canlubang Calamba City, Laguna 4028 Philippines',
  phone: '(+63) 917 834 9596',
  email: 'info@envirocycle-inc.com',
  website: 'www.envirocycle-inc.com',
}

// Brand palette, sampled pixel-for-pixel from a high-res render of the
// reference PDFs (navy header band, lime-green diagonal accent, deep-green
// headings/stat numbers on the certificates; teal top bar on the report).
export const BRAND = {
  navy: [0, 46, 86],
  lime: [145, 205, 68],
  green: [0, 103, 55],
  ink: [31, 41, 55],
  muted: [107, 114, 128],
  border: [209, 213, 219],
  iconCream: [255, 246, 232],
  reportBlue: [69, 171, 204],
}

// Fixed signatories shown on every certificate and the Word report.
export const SIGNATORIES = [
  { name: 'Engr. Wilssie Sanchez', title: 'COMMERCIAL & SUSTAINABILITY ENGINEER' },
  { name: 'Melinda Laconsay', title: 'COMPLIANCE & SUSTAINABILITY MANAGER' },
  { name: 'Timothy Bweheni', title: 'GENERAL MANAGER' },
]

export const CERTIFICATE_TYPES = {
  EIC: {
    id: 'EIC',
    prefix: 'EIC',
    label: 'Environmental Impact Certificate',
    title: 'ENVIRONMENTAL IMPACT CERTIFICATE',
  },
  CAC: {
    id: 'CAC',
    prefix: 'CAC',
    label: 'Carbon Abatement Certificate',
    title: 'CARBON ABATEMENT CERTIFICATE',
  },
  LDC: {
    id: 'LDC',
    prefix: 'LDC',
    label: 'Landfill Diverted Certificate',
    title: 'LANDFILL DIVERTED CERTIFICATE',
  },
  RPC: {
    id: 'RPC',
    prefix: 'RPC',
    label: 'Recycled Plastics Certificate',
    title: 'RECYCLED PLASTICS CERTIFICATE',
  },
}

export const CERTIFICATE_TYPE_LIST = Object.values(CERTIFICATE_TYPES)

/** Legal/compliance disclaimer lines, per certificate type (from the reference PDF). */
export const CERTIFICATE_DISCLAIMER = {
  EIC: 'Calculated in accordance with the GHG Protocol and ISO 14064 (where applicable); processing aligned with R2v3. Diversion and savings estimates support the Zero Waste to Landfill goal and apply an avoided-virgin material approach using EPA WARM and WEEE lifecycle references.',
  CAC: 'Calculated in accordance with the GHG Protocol and ISO 14064 (where applicable); processing aligned with R2v3. Carbon abatement is estimated using an avoided-virgin material approach referencing EPA WARM and WEEE lifecycle sources; distance equivalency assumes 0.25 kg CO2e per km.',
  LDC: 'Calculated in accordance with the GHG Protocol and ISO 14064 (where applicable); processing aligned with R2v3. Diversion and savings estimates support the Zero Waste to Landfill goal and apply an avoided-virgin material approach using EPA WARM and WEEE lifecycle references.',
  RPC: 'Aligned in accordance with Republic Act No. 11898 (Extended Producer Responsibility Act of 2022).',
}

/** kg CO2e avoided per km of passenger-car travel, per the CAC certificate's stated assumption. */
export const KM_PER_KG_CO2E = 1 / 0.25

/** Fixed environmental-benefit blurb per material, from the reference documents. */
export const MATERIAL_BENEFIT_TEXT = {
  Metal: 'Reduces mining and refining impacts.',
  Plastic: 'Reduces petroleum usage and waste.',
  Glass: 'Saves energy in the furnace and reduces raw mineral extraction.',
  Electronics: 'Reduces reliance on rare earth mining.',
}

/** Equivalency assumptions from the reference documents. */
export const EQUIVALENCY = {
  literesPerOlympicPool: 2_500_000,
  kwhPerHouseholdYear: 9_000,
  kgPerAverageCar: 3_000,
}

