import fs from 'node:fs';
import path from 'node:path';
import * as allure from 'allure-js-commons';
import { test, expect } from '../lib/page-object-fixtures';
import AllureHelper from '../evidence/allure-helper';
import { OrderBuilder } from '../test-data';
import { ShipmentNavigationService } from '../services';
import { loadCarrierMatrixConfig, readCarrierMatrixFile } from '../config/carrier-matrix-config';
import {
    buildCarrierMatrix,
    mergeWithPreviousMatrix,
    type CarrierMethodsDiscovery,
    type ShipCodeDiscovery,
} from '../domain/carriers/carrier-matrix';

/**
 * ─── Carrier matrix — discovery (manual, not part of any suite) ────────────────
 *
 * Reads what Configure Shipment offers in this warehouse and writes the matrix file the
 * carrier matrix runs (data/carrier-matrix/<WAREHOUSE_XENVIO>.json, or CARRIER_MATRIX_FILE):
 *   - every Ship Code option, and the Carrier / Ship Method / Package Type it fills in;
 *   - every Carrier option and its Ship Method options.
 *
 * Nothing is bought: it only selects options on an open order created through API v3.
 * Running it again keeps the `enabled` / `note` edited by hand in the file.
 *
 *   npm run carriers:discover
 *
 * See docs/19-carrier-matrix.md.
 */
test.describe('Carrier matrix — discovery', { tag: ['@carrier-matrix'] }, () => {

    test('Discover the ship codes, carriers and ship methods of Configure Shipment', async ({ xenvio, apiOrders }) => {
        test.setTimeout(30 * 60 * 1000);
        const config = xenvio.config;
        const matrixConfig = loadCarrierMatrixConfig();

        await AllureHelper.applyTestMetadata({
            displayName: `Carrier matrix discovery — ${config.warehouse}`,
            owner: 'QA Automation Team',
            tags: ['xenvio', 'carrier-matrix', 'configure-shipment', 'discovery'],
            severity: 'normal',
            epic: 'Xenvio',
            feature: 'Carrier matrix',
            story: 'Discover what Configure Shipment offers',
            parentSuite: 'Carrier Matrix',
            suite: 'Discovery',
        });

        const order = await apiOrders.createOpenOrder(OrderBuilder.domestic().build(), config.warehouse);
        const session = await xenvio.openSession();
        const orderPage = await ShipmentNavigationService.openByUrl(session.page, {
            shipmentNumber: order.shipmentNumber,
            warehouseId: order.warehouseId,
            appId: 0,
        });
        const panel = orderPage.configPanel;
        await panel.expandPanel();

        const shipCodes = await allure.step('Read every Ship Code and what it fills in', async () => {
            const options = await panel.listShipCodeOptions();
            console.log(`📋 ${options.length} ship code option(s)`);

            const discovered: ShipCodeDiscovery[] = [];
            const seen = new Map<string, number>();
            for (const shipCode of options) {
                const occurrence = (seen.get(shipCode) ?? 0) + 1;
                seen.set(shipCode, occurrence);
                try {
                    await panel.selectShipCodeExact(shipCode, occurrence);
                    await panel.waitForShipMethodFilled();
                    const shown = await panel.readSelection();
                    discovered.push({ shipCode, carrier: shown.carrier, method: shown.shipMethod, packageType: shown.packageType });
                } catch (error) {
                    console.warn(`⚠️ Could not select ship code "${shipCode}": ${(error as Error).message.split('\n')[0]}`);
                    await session.page.keyboard.press('Escape');
                    discovered.push({ shipCode, carrier: null, method: null, packageType: null });
                }
            }
            return discovered;
        });

        const carrierMethods = await allure.step('Read every Carrier and its Ship Methods', async () => {
            const carriers = await panel.listCarrierOptions();
            console.log(`📋 ${carriers.length} carrier option(s)`);

            const discovered: CarrierMethodsDiscovery[] = [];
            for (const carrier of carriers) {
                try {
                    await panel.selectCarrierExact(carrier);
                    const methods = await panel.listShipMethodOptions();
                    console.log(`   ${carrier}: ${methods.length} ship method(s)`);
                    discovered.push({ carrier, methods });
                } catch (error) {
                    console.warn(`⚠️ Could not read the ship methods of "${carrier}": ${(error as Error).message.split('\n')[0]}`);
                    await session.page.keyboard.press('Escape');
                    discovered.push({ carrier, methods: [] });
                }
            }
            return discovered;
        });

        const matrix = mergeWithPreviousMatrix(
            buildCarrierMatrix(config.warehouse, shipCodes, carrierMethods),
            readCarrierMatrixFile(matrixConfig.file),
        );
        fs.mkdirSync(path.dirname(matrixConfig.file), { recursive: true });
        fs.writeFileSync(matrixConfig.file, `${JSON.stringify(matrix, null, 2)}\n`);

        const enabled = matrix.entries.filter((entry) => entry.enabled).length;
        console.log(`\n✅ ${matrix.entries.length} entries written to ${matrixConfig.file} (${enabled} enabled)`);
        await allure.attachment('Carrier matrix file', JSON.stringify(matrix, null, 2), 'application/json');
        await AllureHelper.addRunParameters({
            'Matrix file': matrixConfig.file,
            'Ship codes': shipCodes.length,
            Carriers: carrierMethods.length,
            'Entries enabled': `${enabled} of ${matrix.entries.length}`,
        });

        expect(shipCodes.length + carrierMethods.length, 'Configure Shipment must offer ship codes or carriers').toBeGreaterThan(0);
    });
});
