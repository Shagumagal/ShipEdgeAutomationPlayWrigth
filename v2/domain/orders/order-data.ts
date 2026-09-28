/**
 * Data contracts shared by the Xenvio order flows: who receives the shipment, how the
 * package is measured and what an international item or a return label needs.
 * Pure types — the values that fill them live in v2/test-data.
 */

export interface RecipientData {
    name: string;
    company?: string;
    email: string;
    phone?: string;
    address1: string;
    address2?: string;
    state: string;
    city: string;
    zip: string;
    country: string;
}

export interface ProductDimensions {
    qty: string;
    length: string;
    width: string;
    height: string;
    weight: string;
}

export interface NewOrderData {
    recipient: RecipientData;
    product: ProductDimensions;
}

export interface ReturnLabelData {
    locationName: string;
    company: string;
    phone: string;
    email: string;
    parseAddress: string;
    carrier: string;
    shipCode: string;
}

/**
 * Recipient data for international orders.
 * Country must be the country's name or ISO code accepted by the Xenvio autocomplete
 * (e.g. 'GB', 'Canada', 'Mexico').
 */
export interface InternationalRecipient extends RecipientData {
    /** Non-US country code or name (e.g. 'GB', 'Mexico') */
    country: string;
}

/**
 * Item payload for international shipments.
 * Adds the extra customs fields required when shipping across borders.
 */
export interface InternationalItemData {
    sku: string;
    weight: string;
    length: string;
    width: string;
    height: string;
    itemDescription: string;
    harmonizationCode: string;
    countryOfOrigin: string;
    unitPrice: string;
    qty: string;
}
