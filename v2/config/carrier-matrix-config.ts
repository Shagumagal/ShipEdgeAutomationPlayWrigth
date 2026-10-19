import fs from 'node:fs';
import path from 'node:path';
import {
    shipCodeEntriesFromList,
    type CarrierMatrixEntry,
    type CarrierMatrixFile,
    type CarrierMatrixMode,
} from '../domain/carriers/carrier-matrix';

type Environment = Record<string, string | undefined>;

export interface CarrierMatrixConfig {
    readonly mode: CarrierMatrixMode;
    /** Matrix file written by discovery and read by the matrix spec. */
    readonly file: string;
    /** CARRIER_MATRIX_SHIP_CODES: ad-hoc list that replaces the file. */
    readonly shipCodes: string | null;
    /** Label mode refuses production-like carrier accounts unless this is true. */
    readonly allowProduction: boolean;
}

/** Default file of a warehouse: data/carrier-matrix/<WAREHOUSE_XENVIO>.json */
export function defaultCarrierMatrixFile(warehouse: string | undefined): string {
    return path.join('data', 'carrier-matrix', `${warehouse?.trim() || 'default'}.json`);
}

/** Reads the CARRIER_MATRIX_* variables (see .env.example and docs/19-carrier-matrix.md). */
export function loadCarrierMatrixConfig(env: Environment = process.env): CarrierMatrixConfig {
    const mode = (env.CARRIER_MATRIX_MODE?.trim() || 'rates').toLowerCase();
    if (mode !== 'rates' && mode !== 'label') {
        throw new Error(`CARRIER_MATRIX_MODE must be "rates" or "label"; received "${env.CARRIER_MATRIX_MODE}".`);
    }

    return Object.freeze({
        mode,
        file: env.CARRIER_MATRIX_FILE?.trim() || defaultCarrierMatrixFile(env.WAREHOUSE_XENVIO),
        shipCodes: env.CARRIER_MATRIX_SHIP_CODES?.trim() || null,
        allowProduction: env.CARRIER_MATRIX_ALLOW_PRODUCTION === '1',
    });
}

export function readCarrierMatrixFile(file: string): CarrierMatrixFile | null {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CarrierMatrixFile;
}

/**
 * Entries to probe: CARRIER_MATRIX_SHIP_CODES when set, otherwise the matrix file.
 * `problem` explains what to do when there is nothing to run.
 */
export function resolveCarrierMatrixEntries(config: CarrierMatrixConfig): {
    entries: CarrierMatrixEntry[];
    source: string;
    problem: string | null;
} {
    if (config.shipCodes) {
        return { entries: shipCodeEntriesFromList(config.shipCodes), source: 'CARRIER_MATRIX_SHIP_CODES', problem: null };
    }

    const file = readCarrierMatrixFile(config.file);
    if (!file || file.entries.length === 0) {
        return {
            entries: [],
            source: config.file,
            problem: `No carrier matrix entries: ${config.file} ${file ? 'is empty' : 'does not exist'}. `
                + 'Run "npm run carriers:discover" to create it from Configure Shipment, '
                + 'or set CARRIER_MATRIX_SHIP_CODES="EFEXG,EUSEM" to probe a few ship codes.',
        };
    }
    return { entries: file.entries, source: config.file, problem: null };
}
