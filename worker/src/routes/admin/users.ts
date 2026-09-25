import { Hono } from 'hono';
import { getCollection, getDocument, setDocument, deleteDocument } from '../../services/firestore';
import { listFirebaseAuthUsers, createFirebaseAuthUser } from '../../services/firebaseAuthAdmin';

export const usersAdminRouter = new Hono();

// Helper to get allowed admin emails
function getAllowedAdminEmails(env?: any): string[] {
  const raw = env?.ALLOWED_ADMIN_EMAILS || (typeof process !== 'undefined' ? process.env?.ALLOWED_ADMIN_EMAILS : undefined);
  return (raw || 'admin@kitchenbots.com,admin@kitchenbots.in')
    .split(',')
    .map((e: string) => e.trim().toLowerCase());
}

// GET /v1/admin/users
usersAdminRouter.get('/', async (c) => {
  const allowedAdminEmails = getAllowedAdminEmails(c.env);

  // 1. Fetch existing Firestore users
  let firestoreUsers = await getCollection<any>('users', c.env);
  const existingMap = new Map<string, any>();
  for (const u of firestoreUsers) {
    if (u.id) existingMap.set(u.id, u);
    if (u.uid) existingMap.set(u.uid, u);
    if (u.email) existingMap.set(u.email.toLowerCase(), u);
  }

  // 2. Fetch Firebase Auth users
  const authUsers = await listFirebaseAuthUsers(c.env);

  console.log(`[usersAdminRouter] GET /v1/admin/users: firestoreCount=${firestoreUsers.length}, authCount=${authUsers.length}`);

  // 3. Backfill/sync Auth users to Firestore if missing
  for (const authUser of authUsers) {
    const uid = authUser.localId;
    const email = (authUser.email || '').toLowerCase();

    const existingByUid = existingMap.get(uid);
    const existingByEmail = email ? existingMap.get(email) : undefined;
    const existing = existingByUid || existingByEmail;

    if (!existing && uid) {
      const isDefaultAdmin = email && allowedAdminEmails.includes(email);
      const name = authUser.displayName || (email ? email.split('@')[0] : 'User');
      const createdAt = authUser.createdAt
        ? new Date(Number(authUser.createdAt)).toISOString()
        : new Date().toISOString();

      const newDoc = {
        id: uid,
        uid: uid,
        email: authUser.email || '',
        name,
        role: isDefaultAdmin ? 'admin' : 'customer',
        status: authUser.disabled ? 'suspended' : 'active',
        createdAt,
        updatedAt: new Date().toISOString(),
      };

      try {
        const created = await setDocument('users', uid, newDoc, c.env);
        existingMap.set(uid, created);
        if (email) existingMap.set(email, created);
        console.log(`[usersAdminRouter] Synced Auth user ${uid} (${email}) to Firestore as ${newDoc.role}`);
      } catch (err: any) {
        console.error(`[usersAdminRouter] Failed to sync Auth user ${uid} to Firestore:`, err?.message || err);
      }
    } else if (existing && email && allowedAdminEmails.includes(email) && existing.role !== 'admin') {
      // Ensure admin email has admin role
      try {
        const updated = await setDocument('users', existing.id || uid, { ...existing, role: 'admin' }, c.env);
        existingMap.set(existing.id || uid, updated);
      } catch (err: any) {
        console.error(`[usersAdminRouter] Failed to update admin role for ${email}:`, err?.message || err);
      }
    }
  }

  // Re-query collection after sync or compile list from existingMap
  firestoreUsers = await getCollection<any>('users', c.env);
  console.log(`[usersAdminRouter] Final users count returned=${firestoreUsers.length}`);
  return c.json({ success: true, data: firestoreUsers });
});

// GET /v1/admin/users/:id
usersAdminRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await getDocument('users', id, c.env);
  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }
  return c.json({ success: true, data: user });
});

// POST /v1/admin/users
usersAdminRouter.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.email || !body.name) {
    return c.json({ success: false, message: 'Name and email are required' }, 400);
  }

  // Provision user in Firebase Auth if not explicitly provided
  let authUid = body.uid;
  let initialPassword = body.password;

  if (!authUid) {
    const authUser = await createFirebaseAuthUser(body.email, initialPassword, body.name, c.env);
    if (authUser?.localId) {
      authUid = authUser.localId;
    }
  }

  const id = authUid || body.id || `user-${Date.now()}`;
  const newUser = await setDocument('users', id, {
    ...body,
    id,
    uid: id,
    role: body.role || 'customer',
    status: body.status || 'active',
    isVerifiedCustomer: true,
  }, c.env);

  return c.json({ success: true, data: newUser, initialPassword: initialPassword || 'Customer123!' }, 201);
});

// PATCH /v1/admin/users/:id
usersAdminRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await getDocument('users', id, c.env);
  if (!existing) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }
  const updated = await setDocument('users', id, { ...existing, ...body }, c.env);
  return c.json({ success: true, data: updated });
});

// DELETE /v1/admin/users/:id
usersAdminRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await deleteDocument('users', id, c.env);
  if (!deleted) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }
  return c.json({ success: true, message: 'User deleted' });
});
