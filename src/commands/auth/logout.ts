import { clearAuthToken } from '../../services/auth/token-manager';
import { globalLogger } from '../../utils/logger';

export async function authLogoutCommand(): Promise<void> {
  await clearAuthToken();
  globalLogger.success('Logged out and cleared stored tokens.');
}
