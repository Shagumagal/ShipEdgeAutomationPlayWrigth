import { FullConfig } from "@playwright/test";
import { promises as fs } from "node:fs";
import path from "node:path";
import logger from "./lib/logger";

async function copyAllureHistory() {
    const projectRoot = __dirname;
    const sourceHistory = path.join(projectRoot, "allure-report", "history");
    const targetResultsDir = path.join(projectRoot, "allure-results");
    const targetHistory = path.join(targetResultsDir, "history");

    try {
        await fs.access(sourceHistory);
    } catch {
        // No previous report history to copy.
        return;
    }

    await fs.mkdir(targetResultsDir, { recursive: true });
    await fs.mkdir(targetHistory, { recursive: true });

    await fs.cp(sourceHistory, targetHistory, {
        recursive: true,
        force: true,
    });
}

async function globalSetup(config: FullConfig) {
    const log = logger({ filename: __filename });
    
    log.info('Starting test suite execution', {
        workers: config.workers,
        projects: config.projects?.map(p => p.name) || [],
        baseURL: config.use?.baseURL || 'not set',
        timeout: config.timeout
    });

    try {
        await copyAllureHistory();
        log.info('Allure history copied successfully');
    } catch (error) {
        log.warn('Allure history copy skipped', { 
            reason: error instanceof Error ? error.message : 'Unknown error' 
        });
    }

    log.info('Global setup completed');
}

export default globalSetup;

