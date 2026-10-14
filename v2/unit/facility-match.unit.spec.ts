import { test, expect } from '@playwright/test';
import { findFacilityCardIndex } from '../domain/facilities/facility-match';

test.describe('findFacilityCardIndex', () => {
    test('picks the exact facility, not the one that merely contains the name', () => {
        const cards = ['Copy of qa22\nDurham, NC', 'qa22\nDurham, NC', 'qa20\nDurham, NC'];
        expect(findFacilityCardIndex(cards, 'qa22')).toBe(1);
    });

    test('is case and whitespace insensitive', () => {
        expect(findFacilityCardIndex(['  QA22  '], 'qa22')).toBe(0);
    });

    test('fails and lists the available cards when none is an exact match', () => {
        expect(() => findFacilityCardIndex(['Copy of qa22', 'qa22-old'], 'qa22'))
            .toThrow(/no facility card is named "qa22".*"Copy of qa22", "qa22-old"/);
    });

    test('fails when the name is ambiguous', () => {
        expect(() => findFacilityCardIndex(['qa22', 'qa22'], 'qa22')).toThrow(/2 facility cards are named/);
    });
});
