import { Hono } from 'hono';
import { getCollection, getDocument, setDocument, deleteDocument } from '../../services/firestore';

export const enquiriesAdminRouter = new Hono();

// GET /v1/admin/enquiries
enquiriesAdminRouter.get('/', async (c) => {
  const enquiries = await getCollection('enquiries', c.env);
  return c.json({ success: true, data: enquiries });
});

// GET /v1/admin/enquiries/:id
enquiriesAdminRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const enquiry = await getDocument('enquiries', id, c.env);
  if (!enquiry) {
    return c.json({ success: false, message: 'Enquiry not found' }, 404);
  }
  return c.json({ success: true, data: enquiry });
});

// POST /v1/admin/enquiries
enquiriesAdminRouter.post('/', async (c) => {
  const body = await c.req.json();
  const firstName = body.firstName || (body.name ? body.name.split(' ')[0] : undefined);
  if (!firstName || !body.email) {
    return c.json({ success: false, message: 'First name (or name) and email are required' }, 400);
  }
  const id = body.id || `enq-${Date.now()}`;
  const newEnquiry = await setDocument('enquiries', id, {
    ...body,
    id,
    firstName,
    status: body.status || 'New',
    source: body.source || 'Direct'
  }, c.env);
  return c.json({ success: true, data: newEnquiry }, 201);
});

// PATCH /v1/admin/enquiries/:id/status
enquiriesAdminRouter.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await getDocument('enquiries', id, c.env);
  if (!existing) {
    return c.json({ success: false, message: 'Enquiry not found' }, 404);
  }
  const updated = await setDocument('enquiries', id, { ...existing, status: body.status }, c.env);
  return c.json({ success: true, data: updated });
});

// DELETE /v1/admin/enquiries/:id
enquiriesAdminRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await deleteDocument('enquiries', id, c.env);
  if (!deleted) {
    return c.json({ success: false, message: 'Enquiry not found' }, 404);
  }
  return c.json({ success: true, message: 'Enquiry deleted' });
});

