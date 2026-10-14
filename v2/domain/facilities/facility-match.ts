/**
 * Picks the facility (warehouse) card that IS the requested one.
 * Pure module — no Playwright. The page object feeds it the text of every card.
 *
 * A substring match is not enough: "Copy of qa22" and "qa22-old" contain "qa22", and taking the
 * first one silently configures the wrong location.
 */
export function findFacilityCardIndex(cardTexts: string[], facilityName: string): number {
    const wanted = normalize(facilityName);

    const matches = cardTexts
        .map((text, index) => ({ index, lines: text.split('\n').map(normalize).filter(Boolean) }))
        .filter(({ lines }) => lines.includes(wanted))
        .map(({ index }) => index);

    if (matches.length === 1) return matches[0];

    const available = cardTexts.map((text) => `"${text.replace(/\s+/g, ' ').trim()}"`).join(', ');
    const problem = matches.length === 0 ? 'no facility card is named' : `${matches.length} facility cards are named`;
    throw new Error(`Cannot select location: ${problem} "${facilityName}" exactly. Available: ${available || 'none'}`);
}

function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
