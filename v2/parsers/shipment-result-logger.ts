import { GetLabelsResult, VoidLabelResult } from './shipment-result-types';

export function logGetLabelsResult(result: GetLabelsResult, rawResponse: any): void {
    console.log('\n══════════════════════════════════════════════');
    console.log('  📦 LABEL TASK RESULT (CAPTURED FROM NETWORK)');
    console.log('══════════════════════════════════════════════');
    console.log(`  📋 Order #       : ${result.orderNumber ?? 'N/A'}`);
    console.log(`  📋 Shipment #    : ${result.shipmentNumber ?? 'N/A'}`);
    console.log(`  🚦 Shipment State: ${result.shipmentState ?? 'N/A'}`);
    console.log(`  💰 finalPostage  : ${result.finalPostage ?? 'N/A'}`);
    console.log(`  💳 shippingCost  : ${result.shippingCost ?? 'N/A'}`);

    const shipmentData = rawResponse?.shipments?.[0];
    if (shipmentData?.rates) {
        const selectedRate = shipmentData.rates.find?.(
            (rate: any) => rate.id === shipmentData.requestedBestRateId || rate.selected
        );
        if (selectedRate?.rate && result.finalPostage !== null) {
            const quoted = parseFloat(selectedRate.rate);
            const actual = result.finalPostage;
            const diff = actual - quoted;
            if (Math.abs(diff) > 0.001) {
                console.log('\n  ⚠️ PRICE DIFFERENCE DETECTED:');
                console.log(`     Quoted at GET RATES : $${quoted.toFixed(2)}`);
                console.log(`     Final charged       : $${actual.toFixed(2)}`);
                console.log(`     Difference          : $${diff > 0 ? '+' : ''}${diff.toFixed(2)}`);
                console.log('     → Possible causes: carrier surcharge, multibox per-piece fee, residential fee');
            } else {
                console.log(`  ✅ Price consistent: $${actual.toFixed(2)}`);
            }
        }
    }

    if (result.labelsByBox.length > 0) {
        console.log('\n  📦 BOXES DETAIL — Tracking & Labels:');
        console.log('  ┌─────────┬──────────────────────────┬────────────┬──────────────────────────────┐');
        console.log('  │ Box     │ Tracking Number          │ State      │ Label URL                    │');
        console.log('  ├─────────┼──────────────────────────┼────────────┼──────────────────────────────┤');
        result.labelsByBox.forEach((box) => {
            const tracking = (box.trackingNumber || 'N/A').padEnd(24);
            const state = (box.state || 'N/A').padEnd(10);
            const labelShort = box.label
                ? box.label.substring(box.label.lastIndexOf('/') + 1).substring(0, 28)
                : 'N/A';
            console.log(`  │ Box ${box.boxIndex}   │ ${tracking} │ ${state} │ ${labelShort.padEnd(28)} │`);
        });
        console.log('  └─────────┴──────────────────────────┴────────────┴──────────────────────────────┘');

        console.log('\n  🏷️  LABEL URL(s) BY BOX — CMD+Click to open:');
        result.labelsByBox.forEach((box) => {
            console.log(`     [Box ${box.boxIndex}] Tracking: ${box.trackingNumber || 'N/A'}`);
            console.log(`     [Box ${box.boxIndex}] Label: ${box.label}`);
            if (box.returnLabel) {
                console.log(`     [Box ${box.boxIndex}] Return: ${box.returnLabel}`);
            }
        });
    }

    if (result.docUrls.length > 0) {
        console.log('\n  📄  DOCUMENT URL(s) — CMD+Click to open:');
        result.docUrls.forEach((url, index) => console.log(`     [${index + 1}] ${url}`));
    }
    console.log('══════════════════════════════════════════════\n');
}

export function logVoidLabelResult(result: VoidLabelResult): void {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('  🗑️  VOID LABEL RESULT (task_executor — void_label)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  📋 Order #       : ${result.orderNumber ?? 'N/A'}`);
    console.log(`  📋 Shipment #    : ${result.shipmentNumber ?? 'N/A'}`);
    console.log(`  🚦 Shipment State: ${result.shipmentState ?? 'N/A'}`);
    console.log(`  🏷️  Label State   : ${result.labelState ?? 'N/A'}`);

    if (result.boxesVoidState.length > 0) {
        console.log('\n  📦 BOXES VOID STATUS:');
        console.log('  ┌─────────┬──────────────────────────┬────────────┬────────────┐');
        console.log('  │ Box     │ Tracking Number          │ State      │ LabelState │');
        console.log('  ├─────────┼──────────────────────────┼────────────┼────────────┤');
        result.boxesVoidState.forEach((box) => {
            const tracking = (box.trackingNumber || 'N/A').padEnd(24);
            const state = (box.state || 'N/A').padEnd(10);
            const labelState = (box.labelState || 'N/A').padEnd(10);
            console.log(`  │ Box ${box.boxIndex}   │ ${tracking} │ ${state} │ ${labelState} │`);
        });
        console.log('  └─────────┴──────────────────────────┴────────────┴────────────┘');
    }

    console.log('══════════════════════════════════════════════════════════════\n');
}

/** Console summary printed after a successful return label validation. */
export function logReturnLabelSummary(evidence: {
    shipmentNumber: string;
    shipmentState: string | null;
    finalPostage: number | null;
    boxes: { trackingNumber: string | null }[];
    details?: Record<string, unknown>;
}): void {
    console.log('');
    console.log('════════════════════════════════════════════');
    console.log('✅  RETURN LABEL VALIDATION PASSED');
    console.log(`    Shipment  : ${evidence.shipmentNumber}`);
    console.log(`    State     : ${evidence.shipmentState}`);
    console.log(`    Tracking  : ${evidence.boxes[0]?.trackingNumber}`);
    console.log(`    Postage   : $${evidence.finalPostage}`);
    console.log(`    Auto RL   : ${evidence.details?.isAutoReturnLabel}`);
    if (evidence.details?.retriedReturnLabel) {
        console.log(`    ⚠️ Return label required retry (initial error: ${evidence.details?.initialReturnLabelError ?? 'unknown'})`);
    }
    console.log('════════════════════════════════════════════');
}
