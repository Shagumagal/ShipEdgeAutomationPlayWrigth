import * as allure from 'allure-js-commons';
import type { TestDataKind } from '../domain/test-data/automation-data';
import type { XenvioApi } from '../infrastructure/xenvio-api';

/** The deletes the registry needs (a fake in unit tests). */
export type TestDataApi = Pick<XenvioApi, 'deleteCarrierAccount' | 'deleteApp' | 'deleteBestRate'>;

interface TrackedRecord {
    kind: TestDataKind;
    id: number;
    name: string;
}

const KIND_LABELS: Record<TestDataKind, string> = {
    carrierAccount: 'carrier',
    app: 'app',
    bestRate: 'best rate',
};

/**
 * Remembers the configuration a test creates in Xenvio (carriers, apps, best rates) and deletes
 * it when the test ends, passed or failed. It deletes by id, so data created by people is never
 * touched. Injected as the `testData` fixture (lib/page-object-fixtures.ts).
 *
 * A failed delete never fails the test: it is reported so the record can be removed by hand or
 * with the purge (v2/maintenance/purge-test-data.spec.ts). KEEP_TEST_DATA=1 keeps everything,
 * e.g. to inspect a failure in the UI.
 */
export class TestDataRegistry {
    private readonly records: TrackedRecord[] = [];

    constructor(
        private readonly api: TestDataApi,
        private readonly keep: boolean = process.env.KEEP_TEST_DATA === '1',
    ) {}

    track(kind: TestDataKind, id: number, name: string): void {
        this.records.push({ kind, id, name });
    }

    /** Deletes in reverse creation order. Returns a description of each record it could not delete. */
    async cleanup(): Promise<string[]> {
        const records = this.records.splice(0).reverse();
        if (records.length === 0) return [];

        if (this.keep) {
            console.log(`🧹 KEEP_TEST_DATA=1 — keeping: ${records.map(describe).join(', ')}`);
            return [];
        }

        const notDeleted: string[] = [];
        for (const record of records) {
            try {
                await allure.step(`Delete test ${describe(record)}`, () => this.delete(record));
                console.log(`🧹 Deleted test ${describe(record)}`);
            } catch (error) {
                notDeleted.push(describe(record));
                console.warn(`⚠️ Could not delete test ${describe(record)}: ${(error as Error).message}`);
            }
        }
        return notDeleted;
    }

    private delete({ kind, id }: TrackedRecord): Promise<void> {
        switch (kind) {
            case 'carrierAccount': return this.api.deleteCarrierAccount(id);
            case 'app': return this.api.deleteApp(id);
            case 'bestRate': return this.api.deleteBestRate(id);
        }
    }
}

function describe({ kind, id, name }: TrackedRecord): string {
    return `${KIND_LABELS[kind]} "${name}" (#${id})`;
}
