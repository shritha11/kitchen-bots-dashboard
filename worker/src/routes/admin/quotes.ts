import { Hono } from 'hono';
import { getCollection, getDocument, setDocument, deleteDocument } from '../../services/firestore';

export const quotesAdminRouter = new Hono();

// Allowed quote status transitions
const ALLOWED_STATUSES = [
  'Draft',
  'Internal Review',
  'Sent to Customer',
  'Customer Viewed',
  'Customer Accepted',
  'Customer Rejected',
  'Expired',
  'Cancelled',
  'Converted to Order'
] as const;

// GET /v1/admin/quotes
quotesAdminRouter.get('/', async (c) => {
  const quotes = await getCollection('quotes', c.env);
  return c.json({ success: true, data: quotes });
});

// GET /v1/admin/quotes/:id
quotesAdminRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const quote = await getDocument('quotes', id, c.env);
  if (!quote) {
    return c.json({ success: false, message: 'Quote not found' }, 404);
  }
  return c.json({ success: true, data: quote });
});

// POST /v1/admin/quotes
quotesAdminRouter.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.companyName || !body.email) {
    return c.json({ success: false, message: 'Missing required fields: companyName and email are required' }, 400);
  }
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ success: false, message: 'Quote must contain at least one line item' }, 400);
  }

  const id = body.id || `qt-${Date.now()}`;
  const quoteNumber = body.quoteNumber || `QT-${Math.floor(10000 + Math.random() * 90000)}`;

  let calculatedSubtotal = 0;
  let calculatedTax = 0;
  const processedItems = body.items.map((item: any) => {
    const unitPrice = Number(item.pricing?.unitPrice ?? item.unitPrice ?? 0);
    const quantity = Number(item.pricing?.quantity ?? item.quantity ?? 1);
    const discount = Number(item.pricing?.discountAmount ?? item.discountAmount ?? 0);
    const taxRate = Number(item.pricing?.taxRate ?? item.taxRate ?? 18);
    const subtotal = unitPrice * quantity - discount;
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;

    calculatedSubtotal += subtotal;
    calculatedTax += taxAmount;

    return {
      id: item.id || crypto.randomUUID(),
      productId: item.productId || 'custom',
      variantId: item.variantId || 'default',
      productName: item.productName || 'Custom Equipment',
      sku: item.sku || `SKU-${Date.now()}`,
      pricing: {
        unitPrice,
        quantity,
        discountAmount: discount,
        taxRate,
        taxAmount,
        subtotal,
        total
      },
      notes: item.notes || ''
    };
  });

  const totalDiscount = Number(body.totalDiscount || 0);
  const shippingCost = Number(body.shippingCost || 0);
  const grandTotal = calculatedSubtotal + calculatedTax + shippingCost - totalDiscount;

  const newQuote = await setDocument('quotes', id, {
    ...body,
    id,
    quoteNumber,
    status: body.status || 'Draft',
    versionNumber: body.versionNumber || 1,
    items: processedItems,
    subtotal: calculatedSubtotal,
    totalTax: calculatedTax,
    totalDiscount,
    shippingCost,
    grandTotal,
    currency: body.currency || 'INR',
    issueDate: body.issueDate || new Date().toISOString(),
    expiryDate: body.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, c.env);

  return c.json({ success: true, data: newQuote }, 201);
});

// PUT /v1/admin/quotes/:id
quotesAdminRouter.put('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await getDocument('quotes', id, c.env);
  if (!existing) {
    return c.json({ success: false, message: 'Quote not found' }, 404);
  }

  const body = await c.req.json();
  const updatedQuote = await setDocument('quotes', id, {
    ...existing,
    ...body,
    versionNumber: (existing.versionNumber || 1) + 1,
    updatedAt: new Date().toISOString()
  }, c.env);

  return c.json({ success: true, data: updatedQuote });
});

// PATCH /v1/admin/quotes/:id/status
quotesAdminRouter.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return c.json({ success: false, message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}` }, 400);
  }

  const existing = await getDocument('quotes', id, c.env);
  if (!existing) {
    return c.json({ success: false, message: 'Quote not found' }, 404);
  }

  const updatedQuote = await setDocument('quotes', id, {
    ...existing,
    status: body.status,
    statusNotes: body.notes || existing.statusNotes,
    updatedAt: new Date().toISOString()
  }, c.env);

  return c.json({ success: true, data: updatedQuote });
});

// POST /v1/admin/quotes/:id/send
quotesAdminRouter.post('/:id/send', async (c) => {
  const id = c.req.param('id');
  const existing = await getDocument('quotes', id, c.env);
  if (!existing) {
    return c.json({ success: false, message: 'Quote not found' }, 404);
  }

  const recipientEmail = existing.email;
  if (!recipientEmail) {
    return c.json({ success: false, message: 'Quote does not have a valid recipient email address' }, 400);
  }

  const resendApiKey = c.env?.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined);
  const sesRegion = c.env?.AWS_SES_REGION || (typeof process !== 'undefined' ? process.env?.AWS_SES_REGION : undefined);

  let emailSent = false;
  let emailError: string | null = null;

  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'KitchenBots Quotes <quotes@kitchenbots.com>',
          to: [recipientEmail],
          subject: `Commercial Equipment Quote #${existing.quoteNumber || id}`,
          html: `<p>Dear ${existing.contactPerson || existing.companyName},</p><p>Your commercial quotation #${existing.quoteNumber || id} for ₹${Number(existing.grandTotal || 0).toLocaleString('en-IN')} has been generated.</p>`,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        emailError = await res.text();
      }
    } catch (err: any) {
      emailError = err?.message || 'Failed to send email via Resend API';
    }
  }

  const updatedQuote = await setDocument('quotes', id, {
    ...existing,
    status: 'Sent to Customer',
    sentAt: new Date().toISOString(),
    lastEmailRecipient: recipientEmail,
    emailSentStatus: emailSent ? 'Sent' : (emailError ? 'Failed' : 'No Email Provider Configured'),
    updatedAt: new Date().toISOString(),
  }, c.env);

  const warning = !emailSent
    ? (emailError || 'Email infrastructure missing: set RESEND_API_KEY or AWS_SES_REGION in Cloudflare Worker secrets to enable live email delivery.')
    : undefined;

  return c.json({
    success: true,
    data: updatedQuote,
    emailSent,
    recipientEmail,
    warning,
  });
});

// DELETE /v1/admin/quotes/:id
quotesAdminRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await deleteDocument('quotes', id, c.env);
  if (!deleted) {
    return c.json({ success: false, message: 'Quote not found' }, 404);
  }
  return c.json({ success: true, message: 'Quote deleted' });
});
