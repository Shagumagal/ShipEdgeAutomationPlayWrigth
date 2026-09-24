import { test, expect } from '@playwright/test';
import {
    carrierNameFromUrl,
    describeTaskError,
    extractCarrierMessage,
    hasEmptyBasicCredentials,
    isCarrierTaskError,
    summarizeCarrierErrors,
} from '../domain/carriers/carrier-errors';
import { formatCarrierError } from '../diagnostics/carrier-failure-report';
import {
    LABEL_MISSING_RATE_ERROR,
    VOID_USPS_TRANSIENT_ERROR,
    easyPost401,
    easyPostOk,
    rateShoppingNoise,
} from './fixtures/carrier-samples';

test.describe('Errores de carrier (View Requests)', { tag: ['@unit', '@carriers'] }, () => {

    test('identifica el carrier por el host y cae al hostname si no lo conoce', () => {
        expect(carrierNameFromUrl('https://api.easypost.com/v2/orders/')).toBe('EasyPost');
        expect(carrierNameFromUrl('https://apis-sandbox.fedex.com/oauth/token')).toBe('FedEx');
        expect(carrierNameFromUrl('https://wwwcie.ups.com/api/shipments')).toBe('UPS');
        expect(carrierNameFromUrl('http://dragon.iot-easy.cn/api/gts/Calculate')).toBe('dragon.iot-easy.cn');
        expect(carrierNameFromUrl(null)).toBe('Unknown carrier');
    });

    test('extrae code y message de respuestas de distintos carriers', () => {
        expect(extractCarrierMessage(easyPost401.response_body)).toEqual({
            code: 'UNAUTHORIZED',
            message: 'Unable to access the requested resource, authorization failed.',
        });
        // FedEx REST
        expect(extractCarrierMessage({ errors: [{ code: 'NOT.AUTHORIZED.ERROR', message: 'Access token expired' }] }))
            .toEqual({ code: 'NOT.AUTHORIZED.ERROR', message: 'Access token expired' });
        // UPS
        expect(extractCarrierMessage({ response: { errors: [{ code: '250002', message: 'Invalid Authentication Information.' }] } }).message)
            .toBe('Invalid Authentication Information.');
        // SOAP / XML y texto plano
        expect(extractCarrierMessage('<soap:Fault><faultstring>Authentication Failed</faultstring></soap:Fault>').message)
            .toBe('Authentication Failed');
        expect(extractCarrierMessage('Internal Server Error').message).toBe('Internal Server Error');
        // UPS logueado como Hash#inspect de Ruby (dato real de View Requests)
        expect(extractCarrierMessage('{"response"=>{"errors"=>[{"code"=>"250002", "message"=>"Invalid Authentication Information."}]}}'))
            .toEqual({ code: '250002', message: 'Invalid Authentication Information.' });
        // JSON serializado como string
        expect(extractCarrierMessage(JSON.stringify(easyPost401.response_body)).code).toBe('UNAUTHORIZED');
    });

    test('detecta credenciales Basic vacías ("Og==" es ":")', () => {
        expect(hasEmptyBasicCredentials(easyPost401.request_header)).toBe(true);
        expect(hasEmptyBasicCredentials({ Authorization: 'Basic ' + Buffer.from('key:').toString('base64') })).toBe(false);
        expect(hasEmptyBasicCredentials({ Authorization: 'Bearer abc' })).toBe(false);
    });

    test('resume solo las llamadas fallidas, de la más nueva a la más vieja, y respeta el inicio del test', () => {
        const errors = summarizeCarrierErrors([rateShoppingNoise, easyPostOk, easyPost401]);
        expect(errors.map((e: { carrier: string; status: number | null }) => `${e.carrier} ${e.status}`)).toEqual(['EasyPost 401', 'dragon.iot-easy.cn 500']);
        expect(formatCarrierError(errors[0])).toBe(
            'EasyPost 401 UNAUTHORIZED: Unable to access the requested resource, authorization failed. (credenciales vacías en la cuenta del carrier)',
        );

        const onlyRecent = summarizeCarrierErrors([rateShoppingNoise, easyPost401], '2026-09-21T19:38:03.500Z');
        expect(onlyRecent.map((e: { carrier: string; status: number | null }) => e.carrier)).toEqual(['EasyPost']);
    });

    test('reconoce errores de carrier en las tareas de Xenvio y no los errores propios de Xenvio', () => {
        expect(isCarrierTaskError(LABEL_MISSING_RATE_ERROR)).toBe(true);
        expect(isCarrierTaskError(VOID_USPS_TRANSIENT_ERROR)).toBe(true);
        expect(isCarrierTaskError('Carrier error message: The label can\'t be generated, please try again.')).toBe(true);
        expect(isCarrierTaskError('only actual owner can manage this shipment')).toBe(false);
        expect(isCarrierTaskError('other user has request release the shipment, Please hold two minutes and try again')).toBe(false);

        expect(describeTaskError(VOID_USPS_TRANSIENT_ERROR)).toBe('the USPS API did not return a valid response');
        expect(describeTaskError(LABEL_MISSING_RATE_ERROR)).toBe(LABEL_MISSING_RATE_ERROR);
    });
});
