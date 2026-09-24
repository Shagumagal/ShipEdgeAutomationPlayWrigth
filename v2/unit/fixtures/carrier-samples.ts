import type { OutgoingRecord } from '../../domain/carriers/carrier-errors';

/**
 * Real carrier errors seen in QA (History → View Requests of S141_MUBNBMLU and
 * task_executor responses), trimmed. Shared by the carrier unit tests.
 */

export const easyPost401: OutgoingRecord = {
    request_url: 'https://api.easypost.com/v2/orders/',
    request_method: 'POST',
    request_header: '{"Authorization"=>"Basic Og=="}',
    request_body: { order: { to_address: { country: 'GB' } } },
    response_code: '401',
    response_body: {
        error: { code: 'UNAUTHORIZED', message: 'Unable to access the requested resource, authorization failed.', errors: [] },
    },
    created_at: '2026-09-21T19:38:04.179Z',
};

export const easyPostOk: OutgoingRecord = {
    request_url: 'https://api.easypost.com/v2/orders/',
    request_method: 'POST',
    response_code: 200,
    response_body: { id: 'order_123' },
    created_at: '2026-09-21T19:38:03.000Z',
};

/** Rate shopping queries this carrier on every run and it always fails in QA (noise). */
export const rateShoppingNoise: OutgoingRecord = {
    request_url: 'http://dragon.iot-easy.cn/api/gts/CalculateFreight',
    request_method: 'POST',
    response_code: 500,
    response_body: 'Internal Server Error',
    created_at: '2026-09-21T19:38:02.000Z',
};

/** task_executor?task=void_label — transient USPS failure (embedded JSON in the error string). */
export const VOID_USPS_TRANSIENT_ERROR = '{"action":"","date":"2026-09-21T19:44:42.676Z","url":"https://api.easypost.com/v2/shipments/shp_94bf/refund","request":"null","response":"the USPS API did not return a valid response"}';

/** task_executor?task=label — permanent: a multibox shipment without the selected rate. */
export const LABEL_MISSING_RATE_ERROR = 'carrier response error: Unable to proceed, one of the shipments does not have the requested rate available to it.)';

/** task_executor error wrapping an EasyPost 401 (permanent: credentials). */
export const EASYPOST_401_TASK_ERROR = 'carrier response error: {"error":{"code":"UNAUTHORIZED","message":"Unable to access the requested resource, authorization failed.","errors":[]}}';
