import { Hono } from 'hono';
import { setDocument } from '../services/firestore';

export const enquiriesPublicRouter = new Hono();

const idempotencyCache = new Map<string, any>();

// POST /v1/enquiries
enquiriesPublicRouter.post('/', async (c) => {
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey);
    return c.json(cached.body, cached.status);
  }

  const body = await c.req.json();
  const contactName = body.name || body.firstName;
  if (!contactName || !body.email) {
    return c.json({ success: false, message: 'Contact details (name/firstName and email) are required' }, 400);
  }

  // Turnstile Verification
  const turnstileSecret = c.env?.TURNSTILE_SECRET_KEY || (typeof process !== 'undefined' ? process.env?.TURNSTILE_SECRET_KEY : undefined);
  const turnstileToken = body.turnstileToken || body['cf-turnstile-response'] || c.req.header('cf-turnstile-response');

  if (turnstileSecret && turnstileSecret !== '1x0000000000000000000000000000000AA') {
    if (!turnstileToken) {
      return c.json({ success: false, message: 'Security verification (Turnstile token) is required' }, 400);
    }
    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      });
      const verifyOutcome = await verifyRes.json() as any;
      if (!verifyOutcome.success) {
        console.warn('[Enquiries] Turnstile verification failed:', verifyOutcome['error-codes']);
        return c.json({
          success: false,
          message: 'Security verification failed. Please refresh the page and try again.',
          errorCodes: verifyOutcome['error-codes'],
        }, 400);
      }
    } catch (err: any) {
      console.error('[Enquiries] Turnstile siteverify error:', err);
    }
  }

  const id = `enq-${Date.now()}`;
  const newEnquiry = await setDocument('enquiries', id, {
    ...body,
    id,
    firstName: contactName,
    lastName: body.lastName || '',
    companyName: body.companyName || body.company || 'Direct Enquiry',
    email: body.email,
    phone: body.phone || '',
    equipmentNeeded: body.equipmentNeeded || body.productName || 'Equipment',
    status: 'New',
    createdAt: new Date().toISOString()
  }, c.env);

  const responseBody = { success: true, data: newEnquiry, id: newEnquiry.id };
  if (idempotencyKey) {
    idempotencyCache.set(idempotencyKey, { body: responseBody, status: 201 });
    try {
      await setDocument('idempotencyRecords', idempotencyKey, {
        key: idempotencyKey,
        response: responseBody,
        createdAt: new Date().toISOString()
      }, c.env);
    } catch {
      // Ignore if firestore rules restrict idempotencyRecords in client mode
    }
  }

  return c.json(responseBody, 201);
});

