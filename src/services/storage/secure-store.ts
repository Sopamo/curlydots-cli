import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const getConfigDir = () => process.env.CURLYDOTS_HOME ?? join(homedir(), '.curlydots');
const getTokenFile = () => join(getConfigDir(), 'tokens.json');
const KEYTAR_SERVICE = 'Curlydots CLI';
const KEYTAR_ACCOUNT = 'default';
const ALGORITHM = 'aes-256-gcm';

interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

const envToken = () => process.env.CURLYDOTS_TOKEN ?? null;

// Keytar is used to store the token in the keychain.
// If it is not available, the token is stored in a file.
const isKeytarDisabled = () => process.env.CURLYDOTS_DISABLE_KEYTAR === '1';

let keytarPromise: Promise<typeof import('keytar') | null> | null = null;
async function loadKeytar() {
  if (isKeytarDisabled()) {
    keytarPromise = null;
    return null;
  }
  if (keytarPromise === null) {
    keytarPromise = import('keytar').catch(() => null);
  }

  return keytarPromise;
}

function ensureConfigDir() {
  mkdirSync(getConfigDir(), { recursive: true });
}

function deriveKey(): Buffer {
  const user = (() => {
    try {
      return userInfo().username;
    } catch {
      return 'curlydots';
    }
  })();

  return createHash('sha256').update(`${user}-${hostname()}`).digest();
}

function encrypt(value: string): EncryptedPayload {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decrypt(payload: EncryptedPayload): string | null {
  try {
    const key = deriveKey();
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

async function saveWithKeytar(value: string): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) return false;

  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, value);
  return true;
}

async function readWithKeytar(): Promise<string | null> {
  const keytar = await loadKeytar();
  if (!keytar) return null;

  return keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
}

async function deleteWithKeytar(): Promise<void> {
  const keytar = await loadKeytar();
  if (!keytar) return;

  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
}

function saveWithFile(value: string) {
  ensureConfigDir();
  const payload = encrypt(value);
  writeFileSync(getTokenFile(), JSON.stringify(payload), 'utf8');
}

function readWithFile(): string | null {
  try {
    const payload = JSON.parse(readFileSync(getTokenFile(), 'utf8')) as EncryptedPayload;
    return decrypt(payload);
  } catch {
    return null;
  }
}

function deleteFileToken() {
  try {
    const tokenFile = getTokenFile();
    if (existsSync(tokenFile)) {
      unlinkSync(tokenFile);
    }
  } catch {
    // ignore
  }
}

export async function saveSecureToken(token: string): Promise<void> {
  const savedToKeytar = await saveWithKeytar(token);
  if (!savedToKeytar) {
    saveWithFile(token);
  }
}

export async function getSecureToken(): Promise<string | null> {
  const tokenFromEnv = envToken();
  if (tokenFromEnv) return tokenFromEnv;

  const keytarToken = await readWithKeytar();
  if (keytarToken) return keytarToken;

  return readWithFile();
}

export async function clearSecureToken(): Promise<void> {
  await deleteWithKeytar();
  deleteFileToken();
}
