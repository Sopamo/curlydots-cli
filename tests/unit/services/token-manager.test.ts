import { expect, mock, spyOn, test } from 'bun:test';
import * as browserLogin from '../../../src/services/auth/browser-login';
import * as secureStore from '../../../src/services/storage/secure-store';

let moduleNonce = 0;

test.each([null, { accessToken: 'old-token', expiresAt: '2020-01-01T00:00:00Z' }])(
  'browser login preserves the supplied backend configuration for missing or expired tokens: %j',
  async (storedToken) => {
    const options = {
      config: {
        apiEndpoint: 'https://selected-backend.example/api',
        frontendUrl: 'https://selected-frontend.example',
        timeout: 1000,
        retries: 0,
        debug: false,
      },
    };
    const token = { accessToken: 'new-token', expiresAt: '2099-01-01T00:00:00Z' };

    try {
      spyOn(secureStore, 'getSecureToken').mockResolvedValue(
        storedToken ? JSON.stringify(storedToken) : null,
      );
      const save = spyOn(secureStore, 'saveSecureToken').mockResolvedValue();
      const login = spyOn(browserLogin, 'runBrowserLogin').mockResolvedValue(token);

      const { getValidToken } = await import(
        `../../../src/services/auth/token-manager.ts?real=${++moduleNonce}`
      );
      expect(await getValidToken(options)).toBe('new-token');
      expect(login).toHaveBeenCalledWith(options);
      expect(save).toHaveBeenCalledWith(JSON.stringify(token));
    } finally {
      mock.restore();
    }
  },
);
