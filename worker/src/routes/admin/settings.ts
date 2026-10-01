import { Hono } from 'hono';
import { getDocument, setDocument } from '../../services/firestore';

export const settingsAdminRouter = new Hono();

// GET /v1/admin/settings
settingsAdminRouter.get('/', async (c) => {
  const settings = await getDocument('settings', 'global', c.env);
  return c.json({ success: true, data: settings || {} });
});

// POST or PUT /v1/admin/settings
const handleSave = async (c: any) => {
  const body = await c.req.json();
  const updated = await setDocument('settings', 'global', body, c.env);
  return c.json({ success: true, data: updated });
};

settingsAdminRouter.post('/', handleSave);
settingsAdminRouter.put('/', handleSave);
