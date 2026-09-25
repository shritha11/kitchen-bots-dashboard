import { getServiceAccountToken } from './firestore';

export interface FirebaseAuthUserRecord {
  localId: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  disabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

export async function listFirebaseAuthUsers(env?: any): Promise<FirebaseAuthUserRecord[]> {
  const clientEmail = env?.FIREBASE_CLIENT_EMAIL || (typeof process !== 'undefined' ? process.env?.FIREBASE_CLIENT_EMAIL : undefined);
  const privateKey = env?.FIREBASE_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env?.FIREBASE_PRIVATE_KEY : undefined);
  const projectId = env?.FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env?.FIREBASE_PROJECT_ID : undefined) || 'kitchen-bots';

  console.log(`[firebaseAuthAdmin] init: projectId=${projectId}, hasEmail=${Boolean(clientEmail)}, hasKey=${Boolean(privateKey)}`);

  if (!clientEmail || !privateKey) {
    console.warn('[firebaseAuthAdmin] Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY; cannot list Auth users.');
    return [];
  }

  try {
    const token = await getServiceAccountToken(clientEmail, privateKey);
    console.log(`[firebaseAuthAdmin] OAuth token obtained successfully`);

    const allUsers: FirebaseAuthUserRecord[] = [];

    // Attempt 1: Identity Toolkit v1 accounts:query
    let url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`;
    console.log(`[firebaseAuthAdmin] POST ${url}`);
    
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ returnUserInfo: true, maxResults: 1000 }),
    });

    console.log(`[firebaseAuthAdmin] accounts:query response status=${res.status}`);

    // Attempt 2: Identity Toolkit v1 accounts:batchGet if 404
    if (!res.ok) {
      const err1 = await res.text();
      console.warn(`[firebaseAuthAdmin] accounts:query failed (${res.status}): ${err1}`);

      url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`;
      console.log(`[firebaseAuthAdmin] POST ${url}`);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxResults: 1000 }),
      });
      console.log(`[firebaseAuthAdmin] accounts:batchGet response status=${res.status}`);
    }

    // Attempt 3: Identity Platform v2 if 404
    if (!res.ok) {
      const err2 = await res.text();
      console.warn(`[firebaseAuthAdmin] accounts:batchGet failed (${res.status}): ${err2}`);

      url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/accounts?pageSize=1000`;
      console.log(`[firebaseAuthAdmin] GET ${url}`);
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log(`[firebaseAuthAdmin] v2 accounts GET response status=${res.status}`);
    }

    if (!res.ok) {
      const errFinal = await res.text();
      console.error(`[firebaseAuthAdmin] All list attempts failed. Final status=${res.status}, error=${errFinal}`);
      return [];
    }

    const data = (await res.json()) as any;
    const rawUsers = data.users || data.userInfo || data.records || [];
    console.log(`[firebaseAuthAdmin] Discovered rawUsers count=${rawUsers.length}`);

    for (const u of rawUsers) {
      allUsers.push({
        localId: u.localId || u.uid,
        email: u.email,
        displayName: u.displayName,
        photoUrl: u.photoUrl,
        disabled: Boolean(u.disabled),
        createdAt: u.createdAt || u.validSince,
        lastLoginAt: u.lastLoginAt,
      });
    }

    return allUsers;
  } catch (err: any) {
    console.error('[firebaseAuthAdmin] Error listing Auth users:', err?.message || err);
    return [];
  }
}

export async function createFirebaseAuthUser(
  email: string,
  password?: string,
  displayName?: string,
  env?: any
): Promise<FirebaseAuthUserRecord | null> {
  const clientEmail = env?.FIREBASE_CLIENT_EMAIL || (typeof process !== 'undefined' ? process.env?.FIREBASE_CLIENT_EMAIL : undefined);
  const privateKey = env?.FIREBASE_PRIVATE_KEY || (typeof process !== 'undefined' ? process.env?.FIREBASE_PRIVATE_KEY : undefined);
  const projectId = env?.FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env?.FIREBASE_PROJECT_ID : undefined) || 'kitchen-bots';

  if (!clientEmail || !privateKey) {
    console.warn('[firebaseAuthAdmin] Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY; skipping Auth user creation.');
    return null;
  }

  try {
    const token = await getServiceAccountToken(clientEmail, privateKey);
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: password || 'Customer123!',
        displayName: displayName || email.split('@')[0],
        emailVerified: true,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[firebaseAuthAdmin] Failed to create Auth user (${res.status}): ${errText}`);
      return null;
    }

    const data = (await res.json()) as any;
    return {
      localId: data.localId || data.uid,
      email: data.email || email,
      displayName: data.displayName || displayName,
    };
  } catch (err: any) {
    console.error('[firebaseAuthAdmin] Error creating Auth user:', err?.message || err);
    return null;
  }
}
