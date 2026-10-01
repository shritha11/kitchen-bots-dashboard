import { Order } from '../types';
import { PaginationParams, PaginatedResponse } from '../services/types';
import { adminFetch } from './adminClient';

export const INITIAL_ORDERS: Order[] = [];

let localOrders: Order[] = [];

function mapFirestoreOrderToDashboardOrder(raw: any): Order {
  const totalPrice = Number(raw.totalPrice || raw.grandTotal || 0);
  const items = Array.isArray(raw.items)
    ? raw.items.map((it: any, index: number) => ({
        id: it.id || `item-${index + 1}-${raw.id}`,
        productId: it.productId || `prod-${index + 1}`,
        variantId: it.variantId || `v-${it.productId || index}`,
        name: it.name || it.productName || 'Kitchen Equipment',
        price: Number(it.pricePaise ? it.pricePaise / 100 : (it.price || it.unitPrice || 0)),
        quantity: Number(it.quantity || 1),
      }))
    : [];

  const shippingAddr = {
    id: `addr-ship-${raw.id}`,
    type: 'shipping' as const,
    addressLine1: raw.shippingAddress?.street || raw.shippingAddress?.addressLine1 || raw.shippingAddress?.address || 'Main Street',
    city: raw.shippingAddress?.city || 'Bangalore',
    state: raw.shippingAddress?.state || 'Karnataka',
    postalCode: raw.shippingAddress?.pincode || raw.shippingAddress?.postalCode || '560001',
    country: raw.shippingAddress?.country || 'India',
  };

  const billingAddr = raw.billingAddress
    ? {
        id: `addr-bill-${raw.id}`,
        type: 'billing' as const,
        addressLine1: raw.billingAddress.street || raw.billingAddress.addressLine1 || raw.billingAddress.address || shippingAddr.addressLine1,
        city: raw.billingAddress.city || shippingAddr.city,
        state: raw.billingAddress.state || shippingAddr.state,
        postalCode: raw.billingAddress.pincode || raw.billingAddress.postalCode || shippingAddr.postalCode,
        country: raw.billingAddress.country || 'India',
      }
    : shippingAddr;

  const rawStatus = (raw.status || 'pending').toLowerCase();

  return {
    id: raw.orderNumber || raw.id,
    customerId: raw.customerId || 'guest',
    customer: {
      id: raw.customerId || 'cust-1',
      name: raw.contactPerson || raw.companyName || raw.customer?.name || raw.shippingAddress?.name || 'Store Customer',
      email: raw.email || raw.customer?.email || 'customer@kitchenbots.com',
      phone: raw.phone || raw.customer?.phone || raw.shippingAddress?.phone || '+91 9490701421',
      role: 'customer',
      addresses: [shippingAddr],
      wishlist: [],
      status: 'active',
      createdAt: raw.createdAt || new Date().toISOString(),
    },
    totalPrice,
    paymentMethod: raw.paymentMethod || 'Online Payment',
    status: rawStatus as any,
    items,
    shippingAddress: shippingAddr,
    billingAddress: billingAddr,
    fulfillments: raw.fulfillments || [],
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export const ordersApi = {
  getOrders: async (params?: PaginationParams): Promise<PaginatedResponse<Order>> => {
    let records: Order[] = [];
    try {
      const json = await adminFetch<{ success: boolean; data: any[] }>('/v1/admin/orders');
      if (json && json.success && Array.isArray(json.data)) {
        const apiOrders = json.data.map(mapFirestoreOrderToDashboardOrder);
        localOrders = [...apiOrders, ...localOrders.filter((lo) => !apiOrders.some((ao) => ao.id === lo.id))];
        records = [...localOrders];
      }
    } catch (err) {
      console.error('[ordersApi.getOrders Error]', err);
    }

    if (records.length === 0) {
      records = [...localOrders];
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      records = records.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.customer?.name || '').toLowerCase().includes(q) ||
          o.items?.some((i) => i.name.toLowerCase().includes(q))
      );
    }
    if (params?.status && params.status !== 'all') {
      records = records.filter((o) => o.status.toLowerCase() === params.status?.toLowerCase());
    }

    const total = records.length;
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      records = records.slice(start, start + params.limit);
    }
    return { data: records, total };
  },

  getOrdersByCustomerId: async (customerId: string, params?: PaginationParams): Promise<PaginatedResponse<Order>> => {
    const all = await ordersApi.getOrders(params);
    const filtered = all.data.filter((o) => o.customerId === customerId);
    return { data: filtered, total: filtered.length };
  },

  getOrderById: async (id: string): Promise<Order> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/orders/${encodeURIComponent(id)}`);
      if (json && json.success && json.data) {
        return mapFirestoreOrderToDashboardOrder(json.data);
      }
    } catch (err) {
      console.error(`[ordersApi.getOrderById Error] ${id}:`, err);
    }

    const order = localOrders.find((o) => o.id === id);
    if (!order) throw new Error(`Order ${id} not found`);
    return order;
  },

  updateOrderStatus: async (id: string, status: Order['status']): Promise<Order> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/orders/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (json && json.success && json.data) {
        const updated = mapFirestoreOrderToDashboardOrder(json.data);
        const index = localOrders.findIndex((o) => o.id === id);
        if (index !== -1) localOrders[index] = updated;
        return updated;
      }
    } catch (err) {
      console.error(`[ordersApi.updateOrderStatus Error] ${id}:`, err);
    }

    const index = localOrders.findIndex((o) => o.id === id);
    if (index === -1) throw new Error(`Order ${id} not found`);
    localOrders[index] = { ...localOrders[index], status };
    return localOrders[index];
  },

  deleteOrder: async (id: string): Promise<void> => {
    localOrders = localOrders.filter((o) => o.id !== id);
  },

  createOrder: async (order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> => {
    const newOrder: Order = {
      ...order,
      id: (order as any).id || `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: (order as any).createdAt || new Date().toISOString(),
      status: order.status || 'pending',
      fulfillments: order.fulfillments || [],
    };

    try {
      const json = await adminFetch<{ success: boolean; data: any }>('/v1/admin/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...newOrder,
          items: (newOrder.items || []).map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
        }),
      });
      if (json && json.success && json.data) {
        const persisted = mapFirestoreOrderToDashboardOrder(json.data);
        localOrders.unshift(persisted);
        return persisted;
      }
    } catch (err) {
      console.warn('[ordersApi.createOrder] Failed to persist order to backend:', err);
    }

    localOrders.unshift(newOrder);
    return newOrder;
  },
};
