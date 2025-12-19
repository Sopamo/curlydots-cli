import { runBrowserLogin } from '../../services/auth/browser-login';
import { persistAuthToken } from '../../services/auth/token-manager';
import { globalLogger } from '../../utils/logger';

export async function authLoginCommand(_args: string[]): Promise<void> {
  try {
    globalLogger.info('Starting browser authentication flow.');
    const token = await runBrowserLogin();
    await persistAuthToken(token);
    globalLogger.success('Logged in successfully. Token stored securely.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    globalLogger.error(`Authentication failed: ${message}`, error instanceof Error ? error : undefined);
    process.exitCode = 1;
  }
}
