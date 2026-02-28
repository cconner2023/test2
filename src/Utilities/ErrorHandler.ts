import { createLogger } from './Logger';
import { getErrorMessage } from './errorUtils';

const logger = createLogger('ErrorHandler');

/** Log an error with context. In development, also logs to console. */
export function logError(context: string, error: unknown): void {
    logger.warn(`[${context}]`, getErrorMessage(error));
}
