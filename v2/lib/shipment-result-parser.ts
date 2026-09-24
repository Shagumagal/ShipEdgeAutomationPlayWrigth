/**
 * Backward-compatible facade for shipment result workflows, types, and logging.
 *
 * Implementation lives in v2/workflows and v2/parsers; v2 services import those directly.
 * This facade stays only so external callers can keep importing
 * this module while parsing, orchestration, and presentation evolve independently.
 */
export { getLabelsAndCaptureResult } from '../workflows/get-labels-workflow';
export { logShipmentState } from '../parsers/shipment-state-logger';
export { voidLabelAndCaptureResult } from '../workflows/void-label-workflow';
export type {
    BoxVoidState,
    GetLabelsResult,
    LabelsByBox,
    VoidLabelResult,
} from '../parsers/shipment-result-types';
