import { describe, it, expect, beforeEach } from 'vitest';
import { orderService } from '../orderService';
import { OrderService as SalesOrderService } from '../sales/orderService';

describe('orderService', () => {
  let createdOrderId: string;

  beforeEach(async () => {
    const newOrderPayload = {
      customerId: 'CUST-TEST-1',
      customer: {
        id: 'CUST-TEST-1',
        name: 'Rohan Das',
        email: 'rohan@test.com',
        phone: '+91 99887 76655',
        role: 'customer' as const,
        addresses: [],
        wishlist: [],
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      },
      totalPrice: 120000,
      paymentMethod: 'Credit Card',
      status: 'shipped' as const,
      items: [
        {
          id: 'ITEM-TEST-1',
          productId: 'prod-1',
          name: 'Commercial BBQ Grill',
          quantity: 1,
          price: 85000,
        },
      ],
      shippingAddress: {
        id: 'ADDR-TEST-1',
        type: 'shipping' as const,
        addressLine1: 'Road No 12, Banjara Hills',
        city: 'Hyderabad',
        state: 'Telangana',
        postalCode: '500034',
        country: 'India',
      },
    };

    const created = await orderService.createOrder(newOrderPayload);
    createdOrderId = created.id;
  });

  it('should retrieve orders and return array', async () => {
    const response = await orderService.getOrders();
    expect(response.data).toBeInstanceOf(Array);
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.total).toBeGreaterThan(0);
  });

  it('should filter orders by status', async () => {
    const response = await orderService.getOrders({ status: 'shipped' });
    expect(response.data).toBeInstanceOf(Array);
    expect(response.data.every((o) => o.status === 'shipped')).toBe(true);
  });

  it('should filter orders by search query', async () => {
    const response = await orderService.getOrders({ search: 'Rohan' });
    expect(response.data).toBeInstanceOf(Array);
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data[0].customer?.name).toContain('Rohan');
  });

  it('should retrieve an order by ID', async () => {
    const order = await orderService.getOrderById(createdOrderId);
    expect(order).toBeDefined();
    expect(order.id).toBe(createdOrderId);
    expect(order.items.length).toBe(1);
  });

  it('should update order status', async () => {
    const updated = await orderService.updateOrderStatus(createdOrderId, 'delivered');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('delivered');
  });

  it('should delete an order', async () => {
    const initialOrders = await orderService.getOrders();
    const countBefore = initialOrders.total;

    await orderService.deleteOrder(createdOrderId);

    const remainingOrders = await orderService.getOrders();
    expect(remainingOrders.total).toBe(countBefore - 1);
  });
});

describe('SalesOrderService (Commercial Admin ERP)', () => {
  it('should support registering and state transitions cleanly', async () => {
    const order = SalesOrderService.registerDirectOrder({
      id: 'ord-test-comm-1',
      orderNumber: 'ORD-9801',
      customerId: 'cust-1',
      companyName: 'Test Commercial Kitchen',
      contactPerson: 'Manager',
      email: 'manager@test.com',
      totalPrice: 100000,
      status: 'Pending Approval',
      shippingAddress: {
        street: '123 Main St',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      items: [
        {
          productId: 'prod-1',
          name: 'Auto-Wok 3000',
          quantity: 1,
          price: 100000,
        },
      ],
    });

    expect(order).toBeDefined();
    expect(order.status).toBe('Pending Approval');

    const orders = SalesOrderService.getAllOrders();
    expect(orders).toBeInstanceOf(Array);
    expect(orders.length).toBeGreaterThan(0);

    const approved = await SalesOrderService.updateStatus(
      'ord-test-comm-1',
      'Approved',
      'admin-1',
      'Operations Admin',
      'Credit line verified'
    );
    expect(approved.status).toBe('Approved');
  });
});
