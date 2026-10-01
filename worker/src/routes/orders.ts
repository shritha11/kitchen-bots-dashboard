import { Hono } from 'hono';
import { getDocument, setDocument } from '../services/firestore';
import { UserContext } from '../middleware/auth';

export const ordersPublicRouter = new Hono();

// POST /v1/orders
ordersPublicRouter.post('/', async (c) => {
  const user = c.get('user') as UserContext | undefined;
  const body = await c.req.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ success: false, message: 'At least one line item is required' }, 400);
  }

  let authoritativeSubtotal = 0;
  const verifiedItems = [];

  for (const item of body.items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return c.json({ success: false, message: 'Invalid item quantity or product ID' }, 400);
    }
    const product = await getDocument('products', item.productId, c.env);
    const isAvailable =
      product &&
      (product.status === 'Active' ||
        product.status === 'active' ||
        product.publicationStatus === 'published' ||
        !product.status);

    if (!isAvailable) {
      return c.json({ success: false, message: `Product ${item.productId} is unavailable` }, 400);
    }

    const price =
      product.price !== undefined && product.price !== null
        ? Number(product.price)
        : product.pricePaise !== undefined
        ? Number(product.pricePaise) / 100
        : 0;

    const lineTotal = price * Number(item.quantity);
    authoritativeSubtotal += lineTotal;

    verifiedItems.push({
      productId: product.id,
      name: product.name,
      price,
      quantity: Number(item.quantity),
      lineTotal
    });
  }

  const id = `ord-${Date.now()}`;
  const orderNumber = body.orderNumber || `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const companyName = body.companyName || body.customerName || body.shippingAddress?.name || user?.name || 'Customer Order';
  const email = body.email || user?.email || body.shippingAddress?.email || 'customer@kitchenbots.com';
  const phone = body.phone || body.shippingAddress?.phone || '+91 9490701421';

  try {
    const newOrder = await setDocument('orders', id, {
      id,
      orderNumber,
      customerId: user?.uid || body.customerId || 'guest',
      companyName,
      contactPerson: companyName,
      email,
      phone,
      items: verifiedItems,
      totalPrice: authoritativeSubtotal,
      grandTotal: authoritativeSubtotal,
      status: body.status || 'Pending',
      paymentMethod: body.paymentMethod || 'Online',
      orderSource: 'Ecommerce',
      shippingAddress: body.shippingAddress || body.delivery || {},
      billingAddress: body.billingAddress || body.shippingAddress || body.delivery || {},
      createdAt: new Date().toISOString()
    }, c.env);

    return c.json({ success: true, data: newOrder, id: newOrder.id }, 201);
  } catch (err: any) {
    return c.json({ success: false, message: err?.message || 'Failed to persist order to database' }, 500);
  }
});

