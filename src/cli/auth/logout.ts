import { clearSecureToken } from '../../services/storage/secure-store';
import { globalLogger } from '../../utils/logger';

export async function authLogoutCommand(): Promise<void> {
  await clearSecureToken();
  globalLogger.success('Logged out and cleared stored tokens.');
}
