import { Readable } from 'stream';
import { GcsAuthOptions } from '../interfaces/gcs.interface';

export function resolveGcsAuthConfig(auth?: GcsAuthOptions) {
  if (!auth) return {};
  
  const config: Record<string, any> = {};
  const keyFilename = auth.keyFilename;
  if (keyFilename) {
    config.keyFilename = keyFilename;
  }
  
  const rawCredentials = auth.keyFileJson;
  const directCredentials = auth.credentials;
  const clientEmail = auth.clientEmail;
  const privateKeyRaw = auth.privateKey;
  
  let credentials: any | undefined = directCredentials ? { ...directCredentials } : undefined;
  
  if (rawCredentials) {
    credentials = parseGcsCredentials(rawCredentials);
  }
  
  if (clientEmail || privateKeyRaw) {
    if (!clientEmail || !privateKeyRaw) {
      throw new Error(
        'GCS inline credentials require both clientEmail and privateKey. Provide both values when using inline credentials.',
      );
    }
    credentials = {
      client_email: clientEmail,
      private_key: normalizePrivateKey(privateKeyRaw),
    };
  }
  
  if (credentials) {
    config.credentials = credentials;
  }
  
  return config;
}

export function ReadableFromBuffer(buf: Buffer | Uint8Array): Readable {
  const r = new Readable();
  r.push(buf);
  r.push(null);
  return r;
}

function parseGcsCredentials(raw: string) {
  let text = raw.trim();
  if (!text.startsWith('{')) {
    try {
      text = Buffer.from(text, 'base64').toString('utf8').trim();
    } catch {
      throw new Error('Failed to decode base64 GCS credentials JSON. Provide valid JSON or base64 encoded JSON.');
    }
  }
  
  try {
    const parsed = JSON.parse(text);
    if (parsed.private_key) {
      parsed.private_key = normalizePrivateKey(parsed.private_key);
    }
    return parsed;
  } catch {
    throw new Error('Invalid GCS credentials JSON provided. Ensure the JSON is correctly formatted.');
  }
}

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, '\n');
}
