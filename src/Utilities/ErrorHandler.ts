import { createLogger } from './Logger';

const logger = createLogger('ErrorHandler');

/** Log an error with context. In development, also logs to console. */
export function logError(context: string, error: unknown): void {
    logger.warn(`[${context}]`, error instanceof Error ? error.message : error);
}
