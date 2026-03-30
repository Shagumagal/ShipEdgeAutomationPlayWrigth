import { faker } from '@faker-js/faker';

/**
 * Test data generators for Xenvio automation tests.
 * Uses @faker-js/faker to produce realistic US data on every run.
 *
 * Usage:
 *   import { generateUSRecipient, generateProductDimensions } from '../lib/test-data';
 *   await newOrderPage.fillRecipientInfo(generateUSRecipient());
 */

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Recipient generators ─────────────────────────────────────────────────────

const validUSAddresses = [
    { address1: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118' },
    { address1: '1200 E 80th St', city: 'Los Angeles', state: 'CA', zip: '90001' },
    { address1: '200 E Randolph St', city: 'Chicago', state: 'IL', zip: '60601' },
    { address1: '1000 Louisiana St', city: 'Houston', state: 'TX', zip: '77002' },
    { address1: '100 N 1st St', city: 'Phoenix', state: 'AZ', zip: '85004' },
    { address1: '100 S Broad St', city: 'Philadelphia', state: 'PA', zip: '19110' },
    { address1: '300 Alamo Plaza', city: 'San Antonio', state: 'TX', zip: '78205' },
    { address1: '111 W Harbor Dr', city: 'San Diego', state: 'CA', zip: '92101' },
    { address1: '1717 N Harwood St', city: 'Dallas', state: 'TX', zip: '75201' },
    { address1: '170 S Market St', city: 'San Jose', state: 'CA', zip: '95113' },
    { address1: '1100 Congress Ave', city: 'Austin', state: 'TX', zip: '78701' },
    { address1: '1 EverBank Blvd', city: 'Jacksonville', state: 'FL', zip: '32202' },
    { address1: '200 Main St', city: 'Fort Worth', state: 'TX', zip: '76102' },
    { address1: '1 Capitol Sq', city: 'Columbus', state: 'OH', zip: '43215' },
    { address1: '888 Brannan St', city: 'San Francisco', state: 'CA', zip: '94103' }
];

/**
 * Generate a random US recipient with all required fields filled.
 * State is returned as 2-letter abbreviation (e.g., "FL", "TX") and forms a valid address.
 */
export function generateUSRecipient(): RecipientData {
    const validAddress = faker.helpers.arrayElement(validUSAddresses);
    return {
        name: faker.person.fullName(),
        company: faker.company.name(),
        email: faker.internet.email({ provider: 'qatest.com' }),
        phone: faker.phone.number({ style: 'national' }),
        address1: validAddress.address1,
        address2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.4 }),
        city: validAddress.city,
        state: validAddress.state,
        zip: validAddress.zip,
        country: 'us',
    };
}

/**
 * Generate a recipient for a specific US state.
 * Useful for testing state-specific carrier rules.
 * @param stateAbbr 2-letter state code e.g. "FL", "CA", "NY"
 */
export function generateUSRecipientForState(stateAbbr: string): RecipientData {
    const validAddressesForState = validUSAddresses.filter(addr => addr.state === stateAbbr.toUpperCase());
    
    // If we have a valid address for this state, pick one, otherwise fallback to the generic random which
    // guarantees a mixed/invalid combination, but avoids throwing an error.
    if (validAddressesForState.length > 0) {
        const validAddress = faker.helpers.arrayElement(validAddressesForState);
        return {
            name: faker.person.fullName(),
            company: faker.company.name(),
            email: faker.internet.email({ provider: 'qatest.com' }),
            phone: faker.phone.number({ style: 'national' }),
            address1: validAddress.address1,
            address2: faker.helpers.maybe(() => faker.location.secondaryAddress(), { probability: 0.4 }),
            city: validAddress.city,
            state: validAddress.state,
            zip: validAddress.zip,
            country: 'us',
        };
    }

    return {
        ...generateUSRecipient(),
        state: stateAbbr, // Warning: This will create an invalid geographical address!
    };
}

/**
 * Pre-built recipients for common test scenarios.
 * These use fixed, known-good addresses to ensure consistent validation.
 */
export const KnownRecipients = {
    miami: {
        name: 'QA Test Recipient',
        company: 'QA Company LLC',
        email: 'qatest@qatest.com',
        phone: '305-555-0100',
        address1: '100 NW 1st Ave',
        city: 'Miami',
        state: 'FL',
        zip: '33101',
        country: 'us',
    } satisfies RecipientData,

    newYork: {
        name: 'John QA Smith',
        company: 'Test Corp Inc',
        email: 'qany@qatest.com',
        phone: '212-555-0200',
        address1: '350 Fifth Ave',
        address2: 'Suite 100',
        city: 'New York',
        state: 'NY',
        zip: '10118',
        country: 'us',
    } satisfies RecipientData,

    losAngeles: {
        name: 'Jane QA Doe',
        email: 'qaca@qatest.com',
        phone: '213-555-0300',
        address1: '6801 Hollywood Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90028',
        country: 'us',
    } satisfies RecipientData,

    texas: {
        name: 'Bob QA Johnson',
        email: 'qatx@qatest.com',
        phone: '214-555-0400',
        address1: '1600 Pacific Ave',
        city: 'Dallas',
        state: 'TX',
        zip: '75201',
        country: 'us',
    } satisfies RecipientData,
} as const;

// ─── Product generators ───────────────────────────────────────────────────────

/**
 * Generate random product dimensions within typical shipping ranges.
 */
export function generateProductDimensions(): ProductDimensions {
    return {
        qty: faker.number.int({ min: 1, max: 10 }).toString(),
        length: faker.number.int({ min: 1, max: 24 }).toString(),
        width: faker.number.int({ min: 1, max: 18 }).toString(),
        height: faker.number.int({ min: 1, max: 12 }).toString(),
        weight: faker.number.int({ min: 1, max: 50 }).toString(),
    };
}

/**
 * Standard small package dimensions — good baseline for smoke tests.
 */
export const StandardPackage: ProductDimensions = {
    qty: '1',
    length: '10',
    width: '8',
    height: '6',
    weight: '5',
};

/**
 * Generate a complete order data object ready for createNewOrder / fillRecipientInfo.
 * @param scenario 'random' | 'miami' | 'newYork' | 'losAngeles' | 'texas'
 */
export function generateOrderData(scenario: keyof typeof KnownRecipients | 'random' = 'random'): NewOrderData {
    const recipient = scenario === 'random'
        ? generateUSRecipient()
        : KnownRecipients[scenario];

    return {
        recipient,
        product: StandardPackage,
    };
}
