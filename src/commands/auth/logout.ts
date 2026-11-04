import { getExplicitAccessToken } from '../../services/auth/service';
import { clearAuthToken, loadAuthToken } from '../../services/auth/token-manager';
import { globalLogger } from '../../utils/logger';

export async function authLogoutCommand(_args: string[]): Promise<void> {
  try {
    const storedToken = await loadAuthToken();
    const explicitToken = getExplicitAccessToken();
    await clearAuthToken();

    if (storedToken) {
      globalLogger.success(
        'Logged out from stored browser session. Stored credentials have been removed.',
      );
    } else {
      globalLogger.info('No stored browser session found.');
    }

    if (explicitToken?.source === 'environment_token') {
      globalLogger.warn('API tokens provided via CURLYDOTS_TOKEN are not revoked by this command.');
    } else if (explicitToken?.source === 'api_key') {
      globalLogger.warn(
        'API tokens provided via .curlydots/auth.json are not revoked by this command.',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    globalLogger.error(`Logout failed: ${message}`, error instanceof Error ? error : undefined);
    process.exitCode = 1;
  }
}
