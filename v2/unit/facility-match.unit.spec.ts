import { test, expect } from '@playwright/test';
import { findFacilityCardIndex } from '../domain/facilities/facility-match';

// A card is "<facility name>\n<company>"; these are real qa22 cards.
const qa22Cards = [
    'clon de qa22\nqa22',
    'Copy of qa20\nqa20',
    'qa22\nMiriam Eizenga',
    'test21\nqa22',
    'test depuracion\nMiriam Eizenga',
];

test.describe('findFacilityCardIndex', () => {
    test('picks the card whose facility name is the requested one, not one whose company or name contains it', () => {
        expect(findFacilityCardIndex(qa22Cards, 'qa22')).toBe(2);
    });

    test('does not pick a card just because its company has the requested name', () => {
        expect(() => findFacilityCardIndex(['clon de qa22\nqa22', 'test21\nqa22'], 'qa22'))
            .toThrow(/no facility card is named "qa22"/);
    });

    test('is case and whitespace insensitive, and accepts a card with no company', () => {
        expect(findFacilityCardIndex(['  QA22  '], 'qa22')).toBe(0);
    });

    test('fails and lists the similar cards when none is an exact match', () => {
        expect(() => findFacilityCardIndex(['Copy of qa22\nx', 'qa22-old\ny', 'other\nz'], 'qa22'))
            .toThrow(/"Copy of qa22 x", "qa22-old y" \(of 3 cards\)/);
    });

    test('fails when the name is ambiguous', () => {
        expect(() => findFacilityCardIndex(['qa22\na', 'qa22\nb'], 'qa22')).toThrow(/2 facility cards are named/);
    });
});
