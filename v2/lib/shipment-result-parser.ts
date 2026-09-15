/**
 * Backward-compatible facade for shipment result workflows, types, and logging.
 *
 * New implementation details live in v2/parsers so consumers can keep importing
 * this module while parsing, orchestration, and presentation evolve independently.
 */
export { getLabelsAndCaptureResult } from '../parsers/get-labels-workflow';
export { logShipmentState } from '../parsers/shipment-state-logger';
export { voidLabelAndCaptureResult } from '../parsers/void-label-workflow';
export type {
    BoxVoidState,
    GetLabelsResult,
    LabelsByBox,
    VoidLabelResult,
} from '../parsers/shipment-result-types';
