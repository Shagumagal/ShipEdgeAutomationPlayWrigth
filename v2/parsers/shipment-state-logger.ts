import { ProductDimensions } from '../../lib/test-data';

/** Analyze and log the full shipment state from a task_executor response. */
export function logShipmentState(responseBody: any, expectedPkg?: ProductDimensions): void {
    const shipment = responseBody?.shipments?.[0];
    if (!shipment) {
        console.warn('⚠️ No shipment data found in task_executor response');
        return;
    }

    const boxes = shipment.boxes || [];
    const customer = shipment.customer;
    const order = shipment.order;
    const methodConfig = shipment.shippingMethodConfig;

    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  📦 SHIPMENT STATE ANALYSIS (task_executor)');
    console.log('═══════════════════════════════════════════════════════════════');

    console.log(`  Shipment #    : ${shipment.shipmentNumber}`);
    console.log(`  State         : ${shipment.aasmState}`);
    console.log(`  Type          : ${shipment.shipmentType}`);
    console.log(`  Final Postage : ${shipment.finalPostage ?? 'N/A'}`);
    console.log(`  Shipping Cost : ${shipment.shippingCost ?? 'N/A'}`);

    if (customer) {
        console.log('');
        console.log('  👤 CUSTOMER');
        console.log(`     Name    : ${customer.name}`);
        console.log(`     Company : ${customer.company}`);
        console.log(`     Email   : ${customer.email}`);
        console.log(`     Phone   : ${customer.phone}`);
        if (customer.address) {
            const address = customer.address;
            console.log(`     Address : ${address.address1}${address.address2 ? ', ' + address.address2 : ''}`);
            console.log(`               ${address.city}, ${address.state} ${address.zip}, ${address.country}`);
            if (address.meta?.addressError) {
                console.warn(`     ⚠️ Address Error: ${address.meta.addressError}`);
            }
        }
    }

    if (methodConfig) {
        console.log('');
        console.log('  🚚 CARRIER CONFIG');
        console.log(`     Ship Code      : ${methodConfig.clientCode}`);
        console.log(`     Method          : ${methodConfig.shippingMethod?.name ?? 'N/A'}`);
        console.log(`     Carrier         : ${methodConfig.shippingMethod?.carrier?.name ?? 'N/A'}`);
        console.log(`     Carrier Account : ${methodConfig.carrierAccount?.name ?? 'N/A'} (id: ${methodConfig.carrierAccountId})`);
        console.log(`     Multibox        : ${methodConfig.shippingMethod?.carrier?.multibox ?? 'N/A'}`);
    }

    if (order) {
        console.log('');
        console.log('  📋 ORDER');
        console.log(`     Order #    : ${order.orderNumber}`);
        console.log(`     Boxes Qty  : ${order.shipments?.[0]?.boxesQuantity ?? 'N/A'}`);
        console.log(`     Items Qty  : ${order.shipments?.[0]?.itemsQuantity ?? 'N/A'}`);
        console.log(`     Warehouse  : ${order.warehouse?.name ?? 'N/A'}`);
    }

    console.log('');
    console.log('  📦 BOXES DETAIL');
    console.log('  ┌─────────┬────────────────────┬────────────┬───────┬──────────────────────────────┐');
    console.log('  │ Box     │ Dimensions (L×W×H)  │ Weight     │ Items │ SKUs                         │');
    console.log('  ├─────────┼────────────────────┼────────────┼───────┼──────────────────────────────┤');

    let hasWarnings = false;

    for (let idx = 0; idx < boxes.length; idx++) {
        const box = boxes[idx];
        const dims = `${box.length}×${box.width}×${box.height}`;
        const weight = `${box.weight} lbs`;
        const itemCount = box.items?.length ?? 0;
        const skus = (box.items || []).map((item: any) => `${item.sku}(qty:${item.quantity})`).join(', ');

        console.log(`  │ Box ${idx + 1}   │ ${dims.padEnd(18)} │ ${weight.padEnd(10)} │ ${String(itemCount).padEnd(5)} │ ${skus.padEnd(28)} │`);

        for (const item of (box.items || [])) {
            const itemDims = `${item.length}×${item.width}×${item.height}`;
            if (expectedPkg) {
                const expectedDims = `${parseFloat(expectedPkg.length)}×${parseFloat(expectedPkg.width)}×${parseFloat(expectedPkg.height)}`;
                if (itemDims !== expectedDims) {
                    console.warn(`  │  ⚠️ Item ${item.sku}: dims ${itemDims} ≠ expected ${expectedDims}`);
                    hasWarnings = true;
                }
                const expectedWeight = parseFloat(expectedPkg.weight);
                if (item.weight !== expectedWeight) {
                    console.warn(`  │  ⚠️ Item ${item.sku}: weight ${item.weight} ≠ expected ${expectedWeight}`);
                    hasWarnings = true;
                }
            }
        }
    }

    console.log('  └─────────┴────────────────────┴────────────┴───────┴──────────────────────────────┘');

    if (boxes.length > 1) {
        const boxDimsSet = new Set(boxes.map((box: any) => `${box.length}×${box.width}×${box.height}`));
        const boxWeightSet = new Set(boxes.map((box: any) => `${box.weight}`));

        if (boxDimsSet.size > 1) {
            console.warn('');
            console.warn('  ⚠️ BOX DIMENSION MISMATCH — boxes have different dimensions:');
            boxes.forEach((box: any, index: number) => {
                console.warn(`     Box ${index + 1}: ${box.length}×${box.width}×${box.height} in, ${box.weight} lbs`);
            });
            console.warn('  → This may cause "rate not available" errors at buy time');
            hasWarnings = true;
        } else {
            console.log('  ✅ All boxes have consistent dimensions');
        }

        if (boxWeightSet.size > 1) {
            console.warn('  ⚠️ BOX WEIGHT MISMATCH — boxes have different weights');
            hasWarnings = true;
        } else {
            console.log('  ✅ All boxes have consistent weights');
        }
    }

    if (!hasWarnings) {
        console.log('  ✅ All data validated — no discrepancies found');
    }

    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
}
