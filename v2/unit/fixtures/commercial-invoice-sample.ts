/**
 * Text items of a real EasyPost commercial invoice (QA-API-20261022-195447-0k0q-S1, x5demo1, USPS
 * Priority Mail International to France), as readPdfText returns them: reading order, trimmed, no blanks.
 */
export const COMMERCIAL_INVOICE_ITEMS: readonly string[] = [
    'Commercial Invoice', 'Sender:', 'QA Automation', 'QA Automation', '106 Capitola Dr',
    'Durham', 'NC', '27713', 'US', 'Phone Number:', '4155550100', 'Email:', 'test@send.com',
    'Recipient:', 'TestInternational', 'OrderInternational FR', '24 Rue de Rivoli', 'Paris',
    'ÎLE-DE-FRANCE', '75004', 'FR', 'Phone Number:', '3142685500', 'Email:', 'test@send.com',
    'Invoice Date:', '2026-10-22', 'Invoice Number:', 'Tracking Code:', 'CM000005042US',
    "Sender's Reference:", '61768', 'Carrier:', 'USPS', 'AES/ITN/Exemption:', 'NOEEI 30.37(a)',
    'Quantity', 'Country of Origin', 'Description of Contents', 'Harmonised', 'Code', 'Weight',
    'Unit Value', 'Subtotal', 'Value', '2', 'US', 'QA customs item', '1234567890', '10.00 lbs',
    '1.00 USD', '2.00 USD', 'Total Net Weight:', '10.000 lbs', 'Total Declared Value:',
    '(USD)', '2.00', 'Total Gross Weight:', '10.500 lbs', 'Freight & Insurance', 'Charges:',
    'USD', '114.53', 'Total Shipment', 'Pieces:', '1', 'Other Charges:', '(USD)', '0.00',
    'Currency Code:', 'USD', 'Total Invoice Amount:', '(USD)', '116.53', 'Type of Export:',
    'Permanent', 'Terms of Trade:', 'DAP - Delivered At Place', 'Reason for Export:', 'merchandise',
    'General Notes:', 'merchandise', 'I/We hereby certify that the information on this invoice is true and correct and that the contents of this shipment are as stated above.',
    'Name:', 'Signature:', '__________________________________',
];
