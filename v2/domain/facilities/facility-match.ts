/**
 * Picks the facility (warehouse) card that IS the requested one.
 * Pure module — no Playwright. The page object feeds it the text of every card.
 *
 * A card renders the facility name on its first line and the company below it, e.g.
 * "qa22 / Miriam Eizenga", "clon de qa22 / qa22", "test21 / qa22". Matching the name anywhere in
 * the card (substring or any line) selects the wrong location: "clon de qa22" and "test21" both
 * contain "qa22". Only the first line is the facility name.
 */
export function findFacilityCardIndex(cardTexts: string[], facilityName: string): number {
    const wanted = normalize(facilityName);

    const matches = cardTexts
        .map((text, index) => ({ index, name: firstLine(text) }))
        .filter(({ name }) => name === wanted)
        .map(({ index }) => index);

    if (matches.length === 1) return matches[0];

    const problem = matches.length === 0 ? 'no facility card is named' : `${matches.length} facility cards are named`;
    throw new Error(`Cannot select location: ${problem} "${facilityName}" exactly. Similar cards: ${similar(cardTexts, wanted)}`);
}

function firstLine(text: string): string {
    return normalize(text.split('\n').find((line) => line.trim() !== '') ?? '');
}

/** Cards whose text mentions the name, so a failure shows what the match was up against (the list has ~190 cards). */
function similar(cardTexts: string[], wanted: string): string {
    const mentions = cardTexts.filter((text) => normalize(text).includes(wanted));
    const shown = (mentions.length > 0 ? mentions : cardTexts.slice(0, 15)).map((text) => `"${text.replace(/\s+/g, ' ').trim()}"`);
    return `${shown.join(', ') || 'none'} (of ${cardTexts.length} cards)`;
}

function normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}
