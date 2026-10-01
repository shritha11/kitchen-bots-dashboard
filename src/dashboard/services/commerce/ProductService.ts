import { CommerceProduct } from '../../types/commerce';
import { PaginatedResponse, PaginationParams } from '../types';
import { SYNCED_PRODUCTS } from '../../data/catalog';
import { adminFetch } from '../../api/adminClient';

// Initialize in-memory store from synced ecommerce catalog
let mockProducts: CommerceProduct[] = [...SYNCED_PRODUCTS];

function normalizeProduct(doc: any): CommerceProduct {
  const id = doc.id || `PROD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const price = Number(doc.pricePaise ? doc.pricePaise / 100 : (doc.price !== undefined ? doc.price : 0));
  const existingCatalogProduct = SYNCED_PRODUCTS.find(
    p => p.id.toLowerCase() === id.toLowerCase() || (id.toLowerCase() === 'prod-001' && p.id === 'prod-1')
  );
  const sku = (doc.sku && doc.sku !== `KB-${id.toUpperCase()}`)
    ? doc.sku
    : (existingCatalogProduct?.sku || doc.sku || `KB-${id.toUpperCase()}`);

  const images = Array.isArray(doc.images) && doc.images.length > 0
    ? doc.images.map((img: any, idx: number) => {
        if (typeof img === 'string') {
          return { id: `img-${id}-${idx + 1}`, url: img, type: 'image' as const, isPrimary: idx === 0, order: idx };
        }
        if (img && typeof img === 'object') {
          return {
            id: img.id || `img-${id}-${idx + 1}`,
            url: img.url || '',
            type: img.type || 'image',
            isPrimary: img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0,
            order: img.order !== undefined ? Number(img.order) : idx
          };
        }
        return { id: `img-${id}-${idx + 1}`, url: String(img || ''), type: 'image' as const, isPrimary: idx === 0, order: idx };
      })
    : (doc.image ? [{ id: `img-${id}`, url: doc.image, type: 'image' as const, isPrimary: true, order: 0 }] : []);

  const specifications = Array.isArray(doc.specifications) && doc.specifications.length > 0
    ? doc.specifications.map((s: any, idx: number) => {
        if (typeof s === 'string') {
          const [name, val] = s.split(': ');
          return { id: `spec-${id}-${idx + 1}`, group: 'General', name: name || 'Spec', value: val || s };
        }
        return {
          id: s.id || `spec-${id}-${idx + 1}`,
          group: s.group || 'General',
          name: s.name || '',
          value: s.value || ''
        };
      })
    : (Array.isArray(doc.specs)
        ? doc.specs.map((s: string, idx: number) => {
            const [name, val] = s.split(': ');
            return { id: `spec-${id}-${idx + 1}`, group: 'General', name: name || 'Spec', value: val || s };
          })
        : []);

  const variants = Array.isArray(doc.variants) && doc.variants.length > 0
    ? doc.variants.map((v: any) => ({
        ...v,
        id: v.id || `VAR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        productId: id,
        name: v.name || `${doc.name} - Standard`,
        sku: v.sku || `${sku}-STD`,
        price: Number(v.price !== undefined ? v.price : price),
        status: v.status || 'Active',
        images: v.images || [],
        specifications: v.specifications || [],
        weightUnit: v.weightUnit || 'kg'
      }))
    : [{
        id: `var-${id}-std`,
        productId: id,
        name: `${doc.name} - Standard`,
        sku: `${sku}-STD`,
        price: price,
        status: doc.status || 'Active',
        images: [],
        specifications: [],
        weightUnit: 'kg' as const,
        attributes: {}
      }];

  return {
    id,
    sku,
    name: doc.name || 'Untitled Product',
    category: doc.category || 'Kitchen Equipment',
    brand: doc.brand || 'KitchenBots',
    shortDescription: doc.shortDescription || doc.description || '',
    description: doc.description || '',
    status: doc.status || 'Active',
    visibility: doc.visibility || 'Public',
    isFeatured: Boolean(doc.isFeatured),
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    images,
    specifications,
    variants,
    seo: doc.seo,
    createdAt: doc.createdAt || new Date().toISOString(),
    updatedAt: doc.updatedAt || new Date().toISOString(),
  };
}

export const CommerceProductService = {
  getProducts: async (params?: PaginationParams & { status?: string, category?: string, search?: string }): Promise<PaginatedResponse<CommerceProduct>> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any[] }>('/v1/admin/products');
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        const apiProducts = json.data.map(normalizeProduct);
        // Merge with mockProducts while preserving unique by ID
        const productMap = new Map<string, CommerceProduct>();
        mockProducts.forEach(p => productMap.set(p.id.toLowerCase(), p));
        apiProducts.forEach(p => productMap.set(p.id.toLowerCase(), p));
        mockProducts = Array.from(productMap.values());
      }
    } catch (err) {
      console.warn('Failed to fetch products from backend API, using local catalog store', err);
    }

    let filtered = [...mockProducts];

    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    if (params?.status) {
      filtered = filtered.filter(p => p.status === params.status);
    }

    if (params?.category) {
      filtered = filtered.filter(p => p.category === params.category);
    }

    const total = filtered.length;
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      filtered = filtered.slice(start, start + params.limit);
    }

    return { data: filtered, total };
  },

  getProductById: async (id: string): Promise<CommerceProduct> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/products/${encodeURIComponent(id)}`);
      if (json && json.success && json.data) {
        const normalized = normalizeProduct(json.data);
        const idx = mockProducts.findIndex(p => p.id.toLowerCase() === id.toLowerCase());
        if (idx !== -1) {
          mockProducts[idx] = normalized;
        } else {
          mockProducts.push(normalized);
        }
        return normalized;
      }
    } catch (err) {
      console.warn(`Failed to fetch product ${id} from API`, err);
    }

    const product = mockProducts.find(
      p => p.id === id || p.id.toLowerCase() === id.toLowerCase() || (id === 'PROD-001' && p.id === 'prod-1')
    );
    if (!product) throw new Error('Product not found');
    return product;
  },

  createProduct: async (productData: Omit<CommerceProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<CommerceProduct> => {
    const id = `PROD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newProduct: CommerceProduct = {
      ...productData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      variants: (productData.variants || []).map(v => ({
        ...v,
        id: v.id || `VAR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        productId: id,
      })),
    };

    mockProducts.push(newProduct);

    // Persist to backend
    try {
      const price = newProduct.variants[0]?.price || 0;
      await adminFetch('/v1/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          ...newProduct,
          price,
        }),
      });
    } catch (err) {
      console.warn('Failed to sync new product to backend API', err);
    }

    return newProduct;
  },

  updateProduct: async (id: string, productData: Partial<CommerceProduct>): Promise<CommerceProduct> => {
    const index = mockProducts.findIndex(
      p => p.id === id || p.id.toLowerCase() === id.toLowerCase() || (id === 'PROD-001' && p.id === 'prod-1')
    );
    if (index === -1) throw new Error('Product not found');

    let variants = productData.variants;
    if (variants) {
      variants = variants.map(v => ({
        ...v,
        id: v.id || `VAR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        productId: id,
      }));
    }

    mockProducts[index] = {
      ...mockProducts[index],
      ...productData,
      ...(variants ? { variants } : {}),
      updatedAt: new Date().toISOString(),
    };

    const updated = mockProducts[index];

    // Persist to backend
    try {
      const price = updated.variants[0]?.price !== undefined ? updated.variants[0].price : undefined;
      await adminFetch(`/v1/admin/products/${encodeURIComponent(updated.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updated,
          ...(price !== undefined ? { price } : {}),
        }),
      });
    } catch (err) {
      console.warn(`Failed to sync product update ${id} to backend API`, err);
    }

    return updated;
  },

  deleteProduct: async (id: string): Promise<void> => {
    mockProducts = mockProducts.filter(p => p.id !== id && p.id.toLowerCase() !== id.toLowerCase());

    try {
      await adminFetch(`/v1/admin/products/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn(`Failed to delete product ${id} from backend API`, err);
    }
  },

  bulkUpdateStatus: async (ids: string[], status: CommerceProduct['status']): Promise<void> => {
    mockProducts = mockProducts.map(p =>
      ids.includes(p.id) ? { ...p, status, updatedAt: new Date().toISOString() } : p
    );

    await Promise.all(
      ids.map(id =>
        adminFetch(`/v1/admin/products/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }).catch(err => console.warn(`Failed to update status for ${id}`, err))
      )
    );
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    mockProducts = mockProducts.filter(p => !ids.includes(p.id));

    await Promise.all(
      ids.map(id =>
        adminFetch(`/v1/admin/products/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }).catch(err => console.warn(`Failed to delete product ${id}`, err))
      )
    );
  },

  getCategoryStats: async () => {
    const stats: Record<string, number> = {};
    mockProducts.forEach(p => {
      const cat = p.category || 'Uncategorized';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  },
};
