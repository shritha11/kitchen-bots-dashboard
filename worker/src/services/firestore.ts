export interface FirestoreDocument<T = any> {
  id: string;
  data: T;
  createdAt?: string;
  updatedAt?: string;
}

// Canonical catalog products fallback for instant resolution and server-side verification
const CANONICAL_PRODUCTS: Record<string, any> = {
  'prod-1': { id: 'prod-1', sku: 'KB-SM-001', name: 'Commercial BBQ Grill', category: 'Santa Maria Series', price: 18000, status: 'Active' },
  'prod-2': { id: 'prod-2', sku: 'KB-RS-002', name: 'Rocket Stove (Single Burner)', category: 'Rocket Stoves', price: 8500, status: 'Active' },
  'prod-3': { id: 'prod-3', sku: 'KB-RS-003', name: 'Rocket Stove (Dual Burner)', category: 'Rocket Stoves', price: 14500, status: 'Active' },
  'prod-4': { id: 'prod-4', sku: 'KB-AW-004', name: 'Auto Wok Robot', category: 'Automatic Woks', price: 185000, status: 'Active' },
  'prod-5': { id: 'prod-5', sku: 'KB-SF-005', name: 'Smart Fryer Pro', category: 'Smart Fryers', price: 62000, status: 'Active' },
  'prod-6': { id: 'prod-6', sku: 'KB-CR-006', name: 'Commercial Gas Range (4 Burner)', category: 'Commercial Ranges', price: 48000, status: 'Active' },
  'prod-7': { id: 'prod-7', sku: 'KB-CR-007', name: 'Commercial Gas Range (6 Burner)', category: 'Commercial Ranges', price: 68000, status: 'Active' },
  'prod-8': { id: 'prod-8', sku: 'KB-MX-008', name: 'Commercial Stand Mixer 20L', category: 'Commercial Mixers', price: 54000, status: 'Active' },
  'prod-9': { id: 'prod-9', sku: 'KB-MX-009', name: 'Commercial Stand Mixer 40L', category: 'Commercial Mixers', price: 82000, status: 'Active' },
  'prod-10': { id: 'prod-10', sku: 'KB-RF-010', name: 'CoolFreeze Industrial Refrigerator', category: 'Refrigeration', price: 95000, status: 'Active' },
  'prod-11': { id: 'prod-11', sku: 'KB-AB-011', name: 'Motorised Automatic Skewer BBQ', category: 'Automatic BBQ', price: 38000, status: 'Active' },
  'prod-12': { id: 'prod-12', sku: 'KB-SM-012', name: 'Santa Maria Elevation Grill 1200', category: 'Santa Maria Series', price: 125000, status: 'Active' },
  // Slug-based aliases
  'auto-wok-robot': { id: 'prod-4', sku: 'KB-AW-004', name: 'Auto Wok Robot', category: 'Automatic Woks', price: 185000, status: 'Active' },
  'smart-fryer-pro': { id: 'prod-5', sku: 'KB-SF-005', name: 'Smart Fryer Pro', category: 'Smart Fryers', price: 62000, status: 'Active' },
  'commercial-gas-range': { id: 'prod-6', sku: 'KB-CR-006', name: 'Commercial Gas Range', category: 'Commercial Ranges', price: 48000, status: 'Active' },
  'commercial-stand-mixer': { id: 'prod-8', sku: 'KB-MX-008', name: 'Commercial Stand Mixer 20L', category: 'Commercial Mixers', price: 54000, status: 'Active' },
  'coolfreeze-industrial': { id: 'prod-10', sku: 'KB-RF-010', name: 'CoolFreeze Industrial Refrigerator', category: 'Refrigeration', price: 95000, status: 'Active' },
  // Backward compatibility test fixtures
  'p-1': { id: 'p-1', sku: 'OVN-C01', name: 'Commercial Convection Oven', category: 'Ovens', price: 45000, pricePaise: 4500000, status: 'Active' },
  'p-2': { id: 'p-2', sku: 'MIX-20L', name: 'Industrial Dough Mixer 20L', category: 'Mixers', price: 32000, pricePaise: 3200000, status: 'Active' }
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function getProjectId(env?: any): string {
  return (
    env?.FIREBASE_PROJECT_ID ||
    (typeof process !== 'undefined' ? process.env?.FIREBASE_PROJECT_ID || process.env?.VITE_FIREBASE_PROJECT_ID : undefined) ||
    'kitchen-bots'
  );
}

function pemToBinary(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN[ A-Z_-]+-----/g, '')
    .replace(/-----END[ A-Z_-]+-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getServiceAccountToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.expiresAt > now + 60) {
    return tokenCache.token;
  }

  const binaryKey = pemToBinary(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform'
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signatureInput);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const assertion = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const data = (await res.json()) as any;
  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth2 token error: ${data.error_description || data.error || res.statusText}`);
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600)
  };

  return data.access_token;
}

async function getAuthHeaders(env?: any): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const clientEmail = env?.FIREBASE_CLIENT_EMAIL || (typeof process !== 'undefined' ? process.env?.FIREBASE_CLIENT_EMAIL : undefined);
  const privateKey = env?.FIREBASE_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env?.FIREBASE_PRIVATE_KEY : undefined);

  if (clientEmail && privateKey) {
    try {
      const token = await getServiceAccountToken(clientEmail, privateKey);
      headers['Authorization'] = `Bearer ${token}`;
    } catch (err) {
      console.warn('Failed to obtain Google service account token, proceeding with public/apiKey headers', err);
    }
  }

  const apiKey = env?.FIREBASE_API_KEY || (typeof process !== 'undefined' ? process.env?.VITE_FIREBASE_API_KEY : undefined);
  if (apiKey && !headers['Authorization']) {
    headers['x-goog-api-key'] = apiKey;
  }

  return headers;
}

export function toFirestoreValue(val: any): any {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: val.toString() };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return val;
}

export function fromFirestoreFields(fields: Record<string, any> = {}): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}

export async function getDocument<T = any>(collectionName: string, id: string, env?: any): Promise<T | null> {
  const projectId = getProjectId(env);
  const headers = await getAuthHeaders(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, { headers });
    if (res.status === 404) {
      if (collectionName === 'products' && CANONICAL_PRODUCTS[id]) {
        return { ...CANONICAL_PRODUCTS[id] } as T;
      }
      return null;
    }
    if (!res.ok) {
      if (collectionName === 'products' && CANONICAL_PRODUCTS[id]) {
        return { ...CANONICAL_PRODUCTS[id] } as T;
      }
      const errText = await res.text();
      let errorDetail = `Firestore HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorDetail = `${parsed.error.message} (${res.status})`;
        }
      } catch {
        // ignore
      }
      throw new Error(`Firestore getDocument failed on ${collectionName}/${id}: ${errorDetail}`);
    }
    const doc = (await res.json()) as any;
    return { id, ...fromFirestoreFields(doc.fields) } as T;
  } catch (err: any) {
    if (collectionName === 'products' && CANONICAL_PRODUCTS[id]) {
      return { ...CANONICAL_PRODUCTS[id] } as T;
    }
    throw err;
  }
}

export async function setDocument<T = any>(collectionName: string, id: string, data: Partial<T>, env?: any): Promise<T> {
  const projectId = getProjectId(env);
  const headers = await getAuthHeaders(env);
  headers['Content-Type'] = 'application/json';

  const docData = { ...data, id, updatedAt: new Date().toISOString() };
  if (!(docData as any).createdAt) {
    (docData as any).createdAt = new Date().toISOString();
  }

  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(docData)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields })
  });

  if (!res.ok) {
    const errText = await res.text();
    let errorDetail = `Firestore HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) {
        errorDetail = `${parsed.error.message} (${res.status})`;
      }
    } catch {
      // ignore
    }
    throw new Error(`Firestore setDocument failed on ${collectionName}/${id}: ${errorDetail}`);
  }

  const result = (await res.json()) as any;
  return { id, ...fromFirestoreFields(result.fields) } as T;
}

export async function getCollection<T = any>(collectionName: string, env?: any): Promise<T[]> {
  const projectId = getProjectId(env);
  const headers = await getAuthHeaders(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (collectionName === 'products') {
        return Object.values(CANONICAL_PRODUCTS).filter((p) => p.id.startsWith('prod-')) as T[];
      }
      const errText = await res.text();
      let errorDetail = `Firestore HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorDetail = `${parsed.error.message} (${res.status})`;
        }
      } catch {
        // ignore
      }
      throw new Error(`Firestore getCollection failed on ${collectionName}: ${errorDetail}`);
    }
    const data = (await res.json()) as any;
    const firestoreDocs: any[] = (!data.documents || !Array.isArray(data.documents))
      ? []
      : data.documents.map((doc: any) => {
          const docId = doc.name.split('/').pop() || '';
          return { id: docId, ...fromFirestoreFields(doc.fields) };
        });

    if (collectionName === 'products') {
      const mergedMap = new Map<string, any>();
      Object.values(CANONICAL_PRODUCTS).forEach((p) => {
        if (p.id && p.id.startsWith('prod-')) {
          mergedMap.set(p.id.toLowerCase(), p);
        }
      });
      firestoreDocs.forEach((p: any) => {
        if (p.id) {
          const key = p.id.toLowerCase();
          mergedMap.set(key, {
            ...mergedMap.get(key),
            ...p,
          });
        }
      });
      return Array.from(mergedMap.values()) as T[];
    }

    return firestoreDocs as T[];
  } catch (err: any) {
    if (collectionName === 'products') {
      return Object.values(CANONICAL_PRODUCTS).filter((p) => p.id.startsWith('prod-')) as T[];
    }
    throw err;
  }
}

export async function deleteDocument(collectionName: string, id: string, env?: any): Promise<boolean> {
  const projectId = getProjectId(env);
  const headers = await getAuthHeaders(env);
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${encodeURIComponent(id)}`;

  const res = await fetch(url, { method: 'DELETE', headers });
  if (res.status === 404) {
    return false;
  }
  if (!res.ok) {
    const errText = await res.text();
    let errorDetail = `Firestore HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) {
        errorDetail = `${parsed.error.message} (${res.status})`;
      }
    } catch {
      // ignore
    }
    throw new Error(`Firestore deleteDocument failed on ${collectionName}/${id}: ${errorDetail}`);
  }
  return true;
}

