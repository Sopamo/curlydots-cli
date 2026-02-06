import { runBrowserLogin } from '../../services/auth/browser-login';
import { isTokenExpired, loadAuthToken, persistAuthToken } from '../../services/auth/token-manager';
import { globalLogger } from '../../utils/logger';

const loginState = { inProgress: false };

export async function authLoginCommand(_args: string[]): Promise<void> {
  if (loginState.inProgress) {
    globalLogger.warn('Authentication already in progress.');
    process.exitCode = 1;
    return;
  }

  const existingToken = await loadAuthToken();
  if (existingToken && !isTokenExpired(existingToken)) {
    globalLogger.success('Already authenticated. Run `curlydots auth logout` to re-authenticate.');
    return;
  }

  loginState.inProgress = true;
  const controller = new AbortController();
  const handleSigint = () => {
    globalLogger.warn('Authentication cancelled by user.');
    controller.abort();
  };

  process.once('SIGINT', handleSigint);

  try {
    globalLogger.info('Starting browser authentication flow.');
    const token = await runBrowserLogin({ signal: controller.signal });
    await persistAuthToken(token);
    globalLogger.success('Logged in successfully. Token stored securely.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    globalLogger.error(`Authentication failed: ${message}`, error instanceof Error ? error : undefined);
    process.exitCode = 1;
  } finally {
    loginState.inProgress = false;
    process.off('SIGINT', handleSigint);
  }
}
