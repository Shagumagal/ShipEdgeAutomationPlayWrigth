import type { CoreImportVerification } from '../domain/orders/core-import-verification';

/** Console presentation of the imported shipment (tables read by QA in the run output). */
export function logImportVerification(result: CoreImportVerification): void {
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('  📋 CORE IMPORT VERIFICATION — Shipment Data in Xenvio');
    console.log('══════════════════════════════════════════════════════════════');

    // ── Shipment Info ─────────────────────────────────────────
    console.log(`  Shipment #         : ${result.shipmentNumber ?? 'N/A'}`);
    console.log(`  Order #            : ${result.orderNumber ?? 'N/A'}`);
    console.log(`  State              : ${result.aasmState ?? 'N/A'}`);
    console.log(`  Ship Code          : ${result.shippingMethodCode ?? 'N/A'}`);

    // ── Customer ──────────────────────────────────────────────
    console.log('');
    console.log('  👤 CUSTOMER');
    console.log(`     Name    : ${result.customerName ?? 'N/A'}`);
    console.log(`     Email   : ${result.customerEmail ?? 'N/A'}`);
    console.log(`     Phone   : ${result.customerPhone ?? 'N/A'}`);
    if (result.customerAddress) {
        const a = result.customerAddress;
        console.log(`     Address : ${a.address1 ?? 'N/A'}`);
        console.log(`               ${a.city ?? '?'}, ${a.state ?? '?'} ${a.zip ?? '?'}, ${a.country ?? '?'}`);
    }

    // ── Carrier / Method ──────────────────────────────────────
    console.log('');
    console.log('  🚚 CARRIER');
    console.log(`     Carrier Name   : ${result.carrierName ?? 'N/A'}`);
    console.log(`     Method Name    : ${result.shippingMethodName ?? 'N/A'}`);
    console.log(`     Ship Code      : ${result.shippingMethodCode ?? 'N/A'}`);

    // ── Warehouse / App ───────────────────────────────────────
    console.log('');
    console.log('  🏭 WAREHOUSE / APP');
    console.log(`     Warehouse : ${result.warehouseName ?? 'N/A'}`);
    console.log(`     App       : ${result.appName ?? 'N/A'}`);

    // ── Boxes Detail ──────────────────────────────────────────
    console.log('');
    console.log('  📦 BOXES');
    console.log('  ┌─────────┬────────────────────┬────────────┬───────┬──────────────────────────────┐');
    console.log('  │ Box     │ Dimensions (L×W×H)  │ Weight     │ Items │ SKUs                         │');
    console.log('  ├─────────┼────────────────────┼────────────┼───────┼──────────────────────────────┤');

    for (const box of result.boxes) {
        const dims = `${box.length}×${box.width}×${box.height}`;
        const weight = `${box.weight}`;
        const itemCount = box.items.length;
        const skus = box.items.map(it => `${it.sku}(qty:${it.quantity})`).join(', ');

        console.log(`  │ Box ${(box.boxNumber ?? '?').padEnd(3)} │ ${dims.padEnd(18)} │ ${weight.padEnd(10)} │ ${String(itemCount).padEnd(5)} │ ${skus.padEnd(28)} │`);
    }

    console.log('  └─────────┴────────────────────┴────────────┴───────┴──────────────────────────────┘');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
}
