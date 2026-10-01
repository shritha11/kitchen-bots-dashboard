import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { OrderService } from '../../services/sales/orderService';
import { TimelineService } from '../../services/sales/timelineService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Box, Truck, CheckCircle, X, ShieldAlert } from 'lucide-react';
import { OrderStatus } from '../../types/sales';
import { Timeline } from '../../components/ui/Timeline';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export const AdminOrderDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState(() => OrderService.getOrder(id || ''));
  const [isLoading, setIsLoading] = useState(!order);
  const [events, setEvents] = useState(() => TimelineService.getEventsForEntity(id || ''));
  const [showApproveDrawer, setShowApproveDrawer] = useState(false);
  const [showShippingDrawer, setShowShippingDrawer] = useState(false);
  const [notes, setNotes] = useState('');

  React.useEffect(() => {
    if (id) {
      let isMounted = true;
      OrderService.fetchOrderById(id)
        .then((fetched) => {
          if (isMounted && fetched) {
            setOrder(fetched);
          }
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [id]);

  if (isLoading) {
    return (
      <PageContainer title="Loading Order..." breadcrumbs={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Loading' }]}>
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-xs">Fetching order details from server...</span>
        </div>
      </PageContainer>
    );
  }

  if (!order) {
    return (
      <PageContainer title="Order Not Found" breadcrumbs={[{ label: 'Orders', href: '/admin/orders' }, { label: 'Not Found' }]}>
        <Card className="p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Order {id} could not be located</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-6">The requested order does not exist or has been removed.</p>
          <Button onClick={() => navigate('/admin/orders')}>Back to Orders</Button>
        </Card>
      </PageContainer>
    );
  }


  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      const updated = await OrderService.updateStatus(order.id, newStatus, user?.id || 'admin', user?.name || 'Admin');
      setOrder(updated);
      setEvents(TimelineService.getEventsForEntity(order.id));
      toast.success(`Order moved to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleApproveWithNotes = async () => {
    try {
      const updated = await OrderService.updateStatus(order.id, 'Approved', user?.id || 'admin', user?.name || 'Admin', notes);
      setOrder(updated);
      setEvents(TimelineService.getEventsForEntity(order.id));
      toast.success('Order Approved');
      setShowApproveDrawer(false);
      setNotes('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleShipWithNotes = async () => {
    try {
      const updated = await OrderService.updateStatus(order.id, 'Shipped', user?.id || 'admin', user?.name || 'Admin', notes);
      setOrder(updated);
      setEvents(TimelineService.getEventsForEntity(order.id));
      toast.success('Order Shipped');
      setShowShippingDrawer(false);
      setNotes('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <PageContainer
      title={order.orderNumber}
      description={`Customer: ${order.companyName} (${order.contactPerson})`}
      homeHref="/admin"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Orders', href: '/admin/orders' },
        { label: order.orderNumber },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/orders')} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Badge
            variant={
              order.status === 'Draft'
                ? 'secondary'
                : order.status === 'Pending Approval'
                ? 'warning'
                : order.status === 'Approved'
                ? 'info'
                : order.status === 'Shipped' || order.status === 'Delivered'
                ? 'default'
                : 'secondary'
            }
          >
            {order.status}
          </Badge>
          <Badge variant="outline">
            Inv: {order.inventoryStatus}
          </Badge>
          <Badge variant="outline">
            Ship: {order.shippingStatus}
          </Badge>
        </div>
      }
      className="h-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Line items and financial summary */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Ordered Equipment & Line Items</CardTitle>
              <CardDescription>Snapshotted contract line items</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">{item.productName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        ₹{item.pricing.unitPrice.toLocaleString('en-IN')} × {item.pricing.quantity}
                      </p>
                    </div>
                    <div className="text-right font-semibold text-xs text-foreground">
                      ₹{item.pricing.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-border pt-4 space-y-2 text-right text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (GST)</span>
                  <span>₹{order.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-foreground pt-2 border-t border-border">
                  <span>Grand Total</span>
                  <span>₹{order.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer & Shipping Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Customer & Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">Contact Person</span>
                <p className="font-medium text-foreground">{order.contactPerson}</p>
                <p className="text-muted-foreground">{order.email}</p>
                <p className="text-muted-foreground">{order.phone || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">Billing Address</span>
                <p className="text-foreground">{order.billingAddress.street}</p>
                <p className="text-muted-foreground">
                  {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postalCode}
                </p>
                <p className="text-muted-foreground">{order.billingAddress.country}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Workflow Actions & Event Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Workflow Actions</CardTitle>
              <CardDescription>Order lifecycle state machine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {order.status === 'Draft' && (
                <Button onClick={() => handleStatusChange('Pending Approval')} className="w-full text-xs">
                  Submit for Approval
                </Button>
              )}

              {order.status === 'Pending Approval' && (
                <Button onClick={() => setShowApproveDrawer(true)} className="w-full text-xs gap-2">
                  <CheckCircle className="w-4 h-4" /> Approve Order
                </Button>
              )}

              {order.status === 'Approved' && (
                <Button onClick={() => handleStatusChange('Inventory Reserved')} className="w-full text-xs gap-2">
                  <Box className="w-4 h-4" /> Reserve Inventory
                </Button>
              )}

              {order.status === 'Inventory Reserved' && (
                <Button onClick={() => handleStatusChange('Packed')} className="w-full text-xs gap-2">
                  <Box className="w-4 h-4" /> Mark Packed
                </Button>
              )}

              {order.status === 'Packed' && (
                <Button onClick={() => setShowShippingDrawer(true)} className="w-full text-xs gap-2">
                  <Truck className="w-4 h-4" /> Mark Shipped (Deduct Stock)
                </Button>
              )}

              {order.status === 'Shipped' && (
                <Button onClick={() => handleStatusChange('Delivered')} className="w-full text-xs gap-2">
                  <CheckCircle className="w-4 h-4" /> Mark Delivered
                </Button>
              )}

              {order.status === 'Delivered' && (
                <Button onClick={() => handleStatusChange('Closed')} variant="secondary" className="w-full text-xs gap-2">
                  <CheckCircle className="w-4 h-4" /> Close Order
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Audit Timeline</CardTitle>
              <CardDescription>Immutable domain events</CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline events={events} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Action Drawers */}
      {(showApproveDrawer || showShippingDrawer) && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full sm:w-96 bg-card border-l border-border h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-base font-semibold text-foreground">
                {showApproveDrawer ? 'Approve Order' : 'Ship Order'}
              </h2>
              <button
                onClick={() => {
                  setShowApproveDrawer(false);
                  setShowShippingDrawer(false);
                  setNotes('');
                }}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {showApproveDrawer ? 'Approval Notes (Optional)' : 'Shipping Details & Tracking'}
                </label>
                <textarea
                  className="w-full bg-background border border-input text-foreground rounded-lg p-2.5 text-xs min-h-[120px] outline-hidden focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  placeholder={
                    showApproveDrawer
                      ? 'Internal review notes regarding commercial terms...'
                      : 'Carrier: Blue Dart, Tracking: BD-9281920...'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-border">
              <Button
                onClick={showApproveDrawer ? handleApproveWithNotes : handleShipWithNotes}
                className="w-full text-xs font-semibold"
              >
                {showApproveDrawer ? 'Confirm Approval' : 'Confirm Dispatch'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default AdminOrderDetails;
