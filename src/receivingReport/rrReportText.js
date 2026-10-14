// Every piece of free text printed on the Incoming Receiving Report, with its
// default value — the RR's counterpart of reports/reportText.js. The template
// prints ONLY what resolveRrText returns: an override replaces the default, an
// empty string blanks it, a missing key uses the default. Line items are not
// here; they're edited as data (see ReceivingReportGenerator.jsx).
//
// Labels and the company block are the HEPI form's fixed wording (from
// "S19029 - ACCENTURE ….pdf"); the values come from the RR Google Sheet.

import { rrTotals } from './rrReportData.js'

const COLUMN_HEADERS = [
  ['colDate', 'DATE'],
  ['colRr', 'Enviro Ref.\nRR NO.'],
  ['colCompany', 'COMPANY NAME'],
  ['colDescription', 'DESCRIPTION'],
  ['colKilos', 'Kilos'],
  ['colPallet', 'Less:\nCage /\nPalettes'],
  ['colNet', 'NET WEIGHTS'],
  ['colQty', 'QTY. PCS.'],
  ['colUom', 'UOM'],
  ['colCategory', 'Category'],
  ['colRemarks', 'Remarks'],
]

/** The ordered list of editable text fields, with default values. */
export function rrTextFields(data) {
  const { header: h, items } = data
  const totals = rrTotals(items)
  const f = (section, key, label, value, multiline = false) => ({ section, key, label, value: value ?? '', multiline })

  return [
    f('Company', 'coName', 'Company name', 'ENVIROCYCLE PHILIPPINES INC.'),
    f('Company', 'coHq', 'Headquarters label', 'Headquarters'),
    f('Company', 'coHqAddress', 'Headquarters address', 'SILANGAN INDUSTRIAL PARK\nBRGY., CANLUBANG, CALAMBA LAGUNA, 4028', true),
    f('Company', 'coBranch', 'Branch office label', 'Branch Office: Main Office'),
    f('Company', 'coBranchAddress', 'Branch office address', 'SILANGAN INDUSTRIAL PARK\nBRGY., CANLUBANG, CALAMBA LAGUNA, 4028', true),
    f('Company', 'coTel', 'Telephone', 'TEL: 6325844478'),

    f('RR details', 'title', 'Title', 'INCOMING RECEIVING REPORT'),
    f('RR details', 'orderTypeLabel', '"Order Type:" label', 'Order Type:'),
    f('RR details', 'orderType', 'Order type', h.orderType),
    f('RR details', 'referenceNoLabel', '"Reference No:" label', 'Reference No:'),
    f('RR details', 'referenceNo', 'Reference no.', h.referenceNo),
    f('RR details', 'receivedDateLabel', '"Received Date:" label', 'Received Date:'),
    f('RR details', 'receivedDate', 'Received date', h.receivedDate),
    f('RR details', 'jobNoLabel', '"JOB NO:" label', 'JOB NO:'),
    f('RR details', 'jobNumber', 'Job no.', h.jobNumber),
    f('RR details', 'scheduleDateLabel', '"Schedule Date:" label', 'Schedule Date:'),
    f('RR details', 'scheduleDate', 'Schedule date', h.scheduleDate),
    f('RR details', 'accountRepLabel', '"Account Rep.:" label', 'Account Rep.:'),
    f('RR details', 'accountRep', 'Account rep.', h.accountRep),

    f('Client', 'accountNameLabel', '"Account Name:" label', 'Account Name:'),
    f('Client', 'accountName', 'Account name', h.accountName),
    f('Client', 'billingLabel', '"Billing Address:" label', 'Billing Address:'),
    f('Client', 'billingAddress', 'Billing address', h.billingAddress, true),
    f('Client', 'pickupLabel', '"Pickup Address:" label', 'Pickup Address:'),
    f('Client', 'pickupAddress', 'Pickup address', h.pickupAddress, true),
    f('Client', 'billingCountry', 'Billing country', 'Country: Philippines'),
    f('Client', 'billingContact', 'Billing contact person', 'Contact Person:'),
    f('Client', 'billingPhone', 'Billing telephone', 'Telephone:'),
    f('Client', 'pickupCountry', 'Pickup country', 'Country: Philippines'),
    f('Client', 'pickupContact', 'Pickup contact person', 'Contact Person:'),
    f('Client', 'pickupPhone', 'Pickup telephone', 'Telephone:'),

    f('Table', 'tableTitle', 'Table title', 'INCOMING RECEIVING REPORT'),
    ...COLUMN_HEADERS.map(([key, value]) => f('Table', key, `Column: ${value.replace(/\n/g, ' ')}`, value, value.includes('\n'))),
    f('Table', 'rowDate', 'Date', h.receivedDate),
    f('Table', 'rowRr', 'RR no.', h.referenceNo),
    f('Table', 'rowCompany', 'Company name (yellow)', h.companyName),
    f('Table', 'totalKilos', 'Total kilos', totals.kilos),
    f('Table', 'totalPallet', 'Total cage / pallets', totals.palletWeight),
    f('Table', 'totalNet', 'Total net weight', totals.netWeight),
    f('Table', 'totalQty', 'Total qty', totals.qty),

    f('Trucking', 'pisLabel', '"PIS No. :" label', 'PIS No. :'),
    f('Trucking', 'pis', 'PIS no.', h.pis),
    f('Trucking', 'gpLabel', '"GP#:" label', 'GP#:'),
    f('Trucking', 'gpNo', 'GP no.', h.gpNo),
    f('Trucking', 'plateLabel', '"Truck Plate no:" label', 'Truck Plate no:'),
    f('Trucking', 'truckPlateNo', 'Truck plate no.', h.truckPlateNo),
    f('Trucking', 'sealLabel', '"Seal No. :" label', 'Seal No. :'),
    f('Trucking', 'sealNo', 'Seal no.', h.sealNo),
    f('Trucking', 'driverLabel', '"DRIVERS NAME:" label', 'DRIVERS NAME:'),
    f('Trucking', 'driverName', "Driver's name", h.driverName),
    f('Trucking', 'licenseLabel', '"DRIVER\'S LICENSE:" label', "DRIVER'S LICENSE:"),
    f('Trucking', 'driverLicense', "Driver's license", h.driverLicense),
    f('Trucking', 'validityLabel', '"VALIDITY:" label', 'VALIDITY:'),
    f('Trucking', 'validity', 'License validity', h.validity),

    f('Expenses', 'expensesLabel', '"Expenses:" label', 'Expenses:'),
    f('Expenses', 'expenses', 'Expenses', ''),
    f('Expenses', 'manpowerLabel', '"Manpower:" label', 'Manpower:'),
    f('Expenses', 'manpower', 'Manpower', ''),
    f('Expenses', 'trucking1Label', '"Trucking:" label (1)', 'Trucking:'),
    f('Expenses', 'trucking1', 'Trucking (1)', ''),
    f('Expenses', 'trucking2Label', '"Trucking:" label (2)', 'Trucking:'),
    f('Expenses', 'trucking2', 'Trucking (2)', ''),
    f('Expenses', 'purchasedCostLabel', '"Purchased Cost" label', 'Purchased Cost'),
    f('Expenses', 'purchasedCost', 'Purchased cost', ''),

    f('Notes & endorsement', 'notesLabel', '"RECEIVING NOTES:" label', 'RECEIVING NOTES:'),
    f('Notes & endorsement', 'receivingNotes', 'Receiving notes', h.receivingNotes, true),
    f('Notes & endorsement', 'endorsedLabel', '"Endorsed to:" label', 'Endorsed to:'),
    ...[
      ['production', 'PRODUCTION DEPT'],
      ['technical', 'TECHNICAL DEPT'],
      ['sales', 'SALES DEPT'],
      ['receivedBy', 'Received by'],
      ['disposal', 'For Disposal'],
      ['warehouseUse', 'Warehouse Use'],
      ['pco', 'PCO ( with PTT)'],
      ['notedBy', 'Noted by:'],
    ].flatMap(([key, label]) => [f('Notes & endorsement', `${key}Label`, `"${label}" label`, label), f('Notes & endorsement', key, `${label} — on the line`, '')]),

    f('Sign-off', 'reportByLabel', '"Report By:" label', 'Report By:'),
    f('Sign-off', 'reportBy', 'Report by', ''),
    f('Sign-off', 'warehouseWorkerLabel', '"Warehouse Worker:" label', 'Warehouse Worker:'),
    f('Sign-off', 'warehouseWorker', 'Warehouse worker', ''),
    f('Sign-off', 'driverSignLabel', '"DRIVER\'S NAME:" label', "DRIVER'S NAME:"),
    f('Sign-off', 'driverSign', "Driver's name (sign-off)", h.driverName),

    f('Footer', 'formCode', 'Form code', 'HEPI FORM - WHSE 4003 REV. 02'),
    f('Footer', 'formEffective', 'Effectivity date', 'Effectivity Date: 11-Feb-2020'),
  ]
}

/** key -> final text (override if set, else the default). */
export function resolveRrText(data) {
  const overrides = data.textOverrides || {}
  const text = {}
  for (const field of rrTextFields(data)) text[field.key] = field.key in overrides ? overrides[field.key] : field.value
  return text
}

// Text that comes from the loaded RR (or is per-RR, like expenses and the
// endorsement names) — cleared when another RR is loaded so it can't carry
// over. Reworded labels and the company block are kept.
const KEPT_KEY = /^(co[A-Z]\w*|title|tableTitle|col[A-Z]\w*|formCode|formEffective|reportBy|\w+Label)$/

/** Drop the overrides that belong to the previous RR, keeping edited labels. */
export function withoutRrDataOverrides(overrides) {
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => KEPT_KEY.test(key)))
}
