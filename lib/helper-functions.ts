export const parseCsvLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
};

export const parseCsvContent = (content: string): string[][] => {
    return content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map(parseCsvLine);
};

export const assertCsvColumns = (content: string, expectedColumns: string[]): void => {
    const rows = parseCsvContent(content);

    if (rows.length === 0) {
        throw new Error('CSV content is empty.');
    }

    const headerRow = rows[0];
    const missingColumns = expectedColumns.filter((column) => !headerRow.includes(column));

    if (missingColumns.length > 0) {
        throw new Error(`Missing columns in CSV: ${missingColumns.join(', ')}`);
    }
};

