import { endAuthRun } from "./v2/infrastructure/xenvio-auth-state";

/** Deletes this run's saved Xenvio sessions (cookies) once every worker has finished. */
async function globalTeardown(): Promise<void> {
    endAuthRun();
}

export default globalTeardown;
