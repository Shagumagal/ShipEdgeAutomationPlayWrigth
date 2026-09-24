import { XenvioConfig } from '../config/xenvio-config';
import type { XenvioAuthStore } from '../infrastructure/xenvio-auth-state';
import { XenvioDashboardPage } from '../page-objects/xenvio-dashboard-page';
import { XenvioLoginPage } from '../page-objects/xenvio-login-page';
import { SessionService } from '../services';
import { XenvioSession } from './xenvio-session';

/** Entry point injected by the Playwright fixture into a v2 scenario. */
export class XenvioTestContext {
    constructor(
        readonly config: XenvioConfig,
        private readonly loginPage: XenvioLoginPage,
        private readonly dashboardPage: XenvioDashboardPage,
        /** Saved session of this worker; null → always log in through the UI. */
        private readonly authStore: XenvioAuthStore | null = null,
    ) {}

    async openSession(): Promise<XenvioSession> {
        const popupPage = await SessionService.loginAndOpenShipperView(
            this.loginPage,
            this.dashboardPage,
            this.config,
            this.authStore,
        );

        return new XenvioSession(popupPage, this.config);
    }
}
