import { globalLogger } from '../../utils/logger';

export async function authStatusCommand(_args: string[]): Promise<void> {
  globalLogger.warn('`curlydots auth status` is not implemented yet.');
}
