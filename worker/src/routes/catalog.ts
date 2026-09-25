import { Hono } from 'hono';
import { getCollection, getDocument } from '../services/firestore';

export const catalogRouter = new Hono();

// GET /v1/catalog/products
catalogRouter.get('/products', async (c) => {
  const isB2bRequest = c.req.query('b2b') === 'true' || c.req.query('visibility') === 'B2B_Only';
  const products = await getCollection('products', c.env);
  // Exclude cost/internal fields for public view and enforce visibility settings
  const publicProducts = products
    .filter((p: any) => {
      const isStatusActive =
        p.status === 'Active' ||
        p.status === 'active' ||
        p.publicationStatus === 'published' ||
        (!p.status && p.publicationStatus !== 'draft' && p.publicationStatus !== 'archived');

      if (!isStatusActive) return false;
      if (p.visibility === 'Hidden') return false;
      if (p.visibility === 'B2B_Only' && !isB2bRequest) return false;
      return true;
    })
    .map((p: any) => {
      const rest = { ...p };
      delete rest.internalNotes;
      delete rest.costPrice;
      const price = rest.price !== undefined && rest.price !== null
        ? Number(rest.price)
        : (rest.pricePaise !== undefined ? Number(rest.pricePaise) / 100 : 0);
      const pricePaise = rest.pricePaise !== undefined && rest.pricePaise !== null
        ? Number(rest.pricePaise)
        : Math.round(price * 100);
      const image = rest.image || (Array.isArray(rest.images) && rest.images[0]) || (Array.isArray(rest.imageKeys) && rest.imageKeys[0]) || '';
      const images = Array.isArray(rest.images) && rest.images.length > 0
        ? rest.images
        : (Array.isArray(rest.imageKeys) && rest.imageKeys.length > 0 ? rest.imageKeys : (image ? [image] : []));

      return {
        ...rest,
        price,
        pricePaise,
        image,
        images,
        status: rest.status || (rest.publicationStatus === 'published' ? 'Active' : rest.publicationStatus || 'Active')
      };
    });

  return c.json({ success: true, data: publicProducts });
});

// GET /v1/catalog/products/:id
catalogRouter.get('/products/:id', async (c) => {
  const idOrSlug = c.req.param('id');
  let product = await getDocument('products', idOrSlug, c.env);

  if (!product) {
    const all = await getCollection('products', c.env);
    product = all.find((p: any) => p.slug === idOrSlug || p.id === idOrSlug) || null;
  }

  if (!product) {
    return c.json({ success: false, message: 'Product not found' }, 404);
  }

  const isAvailable =
    product.status === 'Active' ||
    product.status === 'active' ||
    product.publicationStatus === 'published' ||
    (!product.status && product.publicationStatus !== 'draft' && product.publicationStatus !== 'archived');

  if (!isAvailable) {
    return c.json({ success: false, message: 'Product not found' }, 404);
  }

  const rest = { ...product };
  delete rest.internalNotes;
  delete rest.costPrice;
  const price = rest.price !== undefined && rest.price !== null
    ? Number(rest.price)
    : (rest.pricePaise !== undefined ? Number(rest.pricePaise) / 100 : 0);
  const pricePaise = rest.pricePaise !== undefined && rest.pricePaise !== null
    ? Number(rest.pricePaise)
    : Math.round(price * 100);
  const image = rest.image || (Array.isArray(rest.images) && rest.images[0]) || (Array.isArray(rest.imageKeys) && rest.imageKeys[0]) || '';
  const images = Array.isArray(rest.images) && rest.images.length > 0
    ? rest.images
    : (Array.isArray(rest.imageKeys) && rest.imageKeys.length > 0 ? rest.imageKeys : (image ? [image] : []));

  const publicProduct = {
    ...rest,
    price,
    pricePaise,
    image,
    images,
    status: rest.status || (rest.publicationStatus === 'published' ? 'Active' : rest.publicationStatus || 'Active')
  };

  return c.json({ success: true, data: publicProduct });
});
