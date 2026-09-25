import { Quote, QuoteStatus, QuoteRevision } from '../../types/sales';
import { domainEvents as EventBus } from '../../utils/eventBus';
import { EventFactory } from '../../utils/eventFactory';
import { EventType, EventCategory, AggregateType } from '../../types/events';
import { PricingEngine } from './pricingEngine';
import { adminFetch } from '../../api/adminClient';

export class QuoteService {
  private static quotes: Map<string, Quote> = new Map();
  private static revisions: Map<string, QuoteRevision[]> = new Map(); // quoteId -> revisions[]
  public static lastEventId: Map<string, string> = new Map(); // Tracks causationId per aggregate

  // --- Backend Persistence Helpers ---

  static async fetchQuotes(): Promise<Quote[]> {
    try {
      const json = await adminFetch<{ success: boolean; data: any[] }>('/v1/admin/quotes');
      if (json && json.success && Array.isArray(json.data)) {
        for (const doc of json.data) {
          const mappedQuote: Quote = {
            id: doc.id,
            quoteNumber: doc.quoteNumber || `QT-${doc.id.slice(0, 6).toUpperCase()}`,
            customerId: doc.customerId,
            companyName: doc.companyName || 'Unknown Company',
            contactPerson: doc.contactPerson || 'Contact Person',
            email: doc.email || 'customer@example.com',
            phone: doc.phone,
            gstDetails: doc.gstDetails,
            billingAddress: doc.billingAddress,
            shippingAddress: doc.shippingAddress,
            salesRepId: doc.salesRepId || 'admin',
            status: doc.status || 'Draft',
            issueDate: doc.issueDate || new Date().toISOString(),
            expiryDate: doc.expiryDate || new Date().toISOString(),
            currency: doc.currency || 'INR',
            items: Array.isArray(doc.items) ? doc.items : [],
            subtotal: Number(doc.subtotal || 0),
            totalDiscount: Number(doc.totalDiscount || 0),
            totalTax: Number(doc.totalTax || 0),
            shippingCost: Number(doc.shippingCost || 0),
            grandTotal: Number(doc.grandTotal || 0),
            notes: doc.notes,
            internalNotes: doc.internalNotes,
            attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
            versionNumber: Number(doc.versionNumber || 1),
            originalQuoteId: doc.originalQuoteId,
            correlationId: doc.correlationId,
            causationId: doc.causationId,
            createdAt: doc.createdAt || new Date().toISOString(),
            updatedAt: doc.updatedAt || new Date().toISOString(),
          };
          this.quotes.set(mappedQuote.id, mappedQuote);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch quotes from backend, using local store', err);
    }

    return this.getAllQuotes();
  }

  static async fetchQuoteById(id: string): Promise<Quote> {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/quotes/${encodeURIComponent(id)}`);
      if (json && json.success && json.data) {
        const doc = json.data;
        const mappedQuote: Quote = {
          id: doc.id,
          quoteNumber: doc.quoteNumber || `QT-${doc.id.slice(0, 6).toUpperCase()}`,
          customerId: doc.customerId,
          companyName: doc.companyName || 'Unknown Company',
          contactPerson: doc.contactPerson || 'Contact Person',
          email: doc.email || 'customer@example.com',
          phone: doc.phone,
          gstDetails: doc.gstDetails,
          billingAddress: doc.billingAddress,
          shippingAddress: doc.shippingAddress,
          salesRepId: doc.salesRepId || 'admin',
          status: doc.status || 'Draft',
          issueDate: doc.issueDate || new Date().toISOString(),
          expiryDate: doc.expiryDate || new Date().toISOString(),
          currency: doc.currency || 'INR',
          items: Array.isArray(doc.items) ? doc.items : [],
          subtotal: Number(doc.subtotal || 0),
          totalDiscount: Number(doc.totalDiscount || 0),
          totalTax: Number(doc.totalTax || 0),
          shippingCost: Number(doc.shippingCost || 0),
          grandTotal: Number(doc.grandTotal || 0),
          notes: doc.notes,
          internalNotes: doc.internalNotes,
          attachments: Array.isArray(doc.attachments) ? doc.attachments : [],
          versionNumber: Number(doc.versionNumber || 1),
          originalQuoteId: doc.originalQuoteId,
          correlationId: doc.correlationId,
          causationId: doc.causationId,
          createdAt: doc.createdAt || new Date().toISOString(),
          updatedAt: doc.updatedAt || new Date().toISOString(),
        };
        this.quotes.set(mappedQuote.id, mappedQuote);
        return mappedQuote;
      }
    } catch (err) {
      console.warn(`Failed to fetch quote ${id} from backend`, err);
    }

    const cached = this.quotes.get(id);
    if (!cached) throw new Error(`Quote ${id} not found`);
    return cached;
  }

  static createQuote(
    quoteData: Omit<Quote, 'id' | 'quoteNumber' | 'status' | 'versionNumber' | 'createdAt' | 'updatedAt' | 'subtotal' | 'grandTotal'>,
    userId: string,
    userName: string
  ): Quote {
    const id = crypto.randomUUID();
    const quoteNumber = `QT-${Math.floor(10000 + Math.random() * 90000)}`;
    const correlationId = crypto.randomUUID();

    const calculatedTotals = PricingEngine.calculateTotals(
      quoteData.items.map(i => i.pricing),
      quoteData.totalDiscount,
      quoteData.shippingCost
    );

    const quote: Quote = {
      ...quoteData,
      id,
      quoteNumber,
      status: 'Draft',
      versionNumber: 1,
      correlationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...calculatedTotals,
    };

    this.quotes.set(id, quote);
    this.revisions.set(id, []);

    // Create initial revision
    this.createRevision(quote, userId, 'Initial creation');

    const event = EventFactory.createEvent(
      EventType.QuoteCreated,
      EventCategory.Business,
      id,
      AggregateType.Quote,
      {
        quoteId: id,
        companyName: quote.companyName,
        contactPerson: quote.contactPerson,
        email: quote.email,
        phone: quote.phone,
        salesRepId: quote.salesRepId,
      },
      { id: userId, name: userName, role: 'Sales' },
      correlationId
    );

    this.lastEventId.set(id, event.id);
    EventBus.emit(event);

    // Persist to backend asynchronously
    adminFetch('/v1/admin/quotes', {
      method: 'POST',
      body: JSON.stringify(quote),
    }).catch(err => console.warn('Failed to sync quote to backend', err));

    return quote;
  }

  static getQuote(id: string): Quote | undefined {
    return this.quotes.get(id);
  }

  static getAllQuotes(): Quote[] {
    return Array.from(this.quotes.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static getRevisions(quoteId: string): QuoteRevision[] {
    return this.revisions.get(quoteId) || [];
  }

  private static createRevision(quote: Quote, userId: string, changeNotes?: string): QuoteRevision {
    const revision: QuoteRevision = {
      id: crypto.randomUUID(),
      quoteId: quote.id,
      versionNumber: quote.versionNumber,
      quoteData: JSON.parse(JSON.stringify(quote)),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      changeNotes,
    };

    const revs = this.revisions.get(quote.id) || [];
    revs.push(revision);
    this.revisions.set(quote.id, revs);
    return revision;
  }

  static updateQuote(
    id: string,
    updates: Partial<Quote>,
    userId: string,
    userName: string,
    changeNotes: string = 'Updated quote'
  ): Quote {
    const current = this.quotes.get(id);
    if (!current) throw new Error(`Quote ${id} not found`);

    if (['Customer Accepted', 'Customer Rejected', 'Cancelled', 'Converted to Order'].includes(current.status)) {
      throw new Error(`Cannot modify quote in ${current.status} status.`);
    }

    const items = updates.items || current.items;
    const discount = updates.totalDiscount ?? current.totalDiscount;
    const shipping = updates.shippingCost ?? current.shippingCost;

    const calculatedTotals = PricingEngine.calculateTotals(
      items.map(i => i.pricing),
      discount,
      shipping
    );

    const updatedQuote: Quote = {
      ...current,
      ...updates,
      ...calculatedTotals,
      versionNumber: current.versionNumber + 1,
      updatedAt: new Date().toISOString(),
    };

    this.quotes.set(id, updatedQuote);
    this.createRevision(updatedQuote, userId, changeNotes);

    const causationId = this.lastEventId.get(id);
    const event = EventFactory.createEvent(
      EventType.QuoteUpdated,
      EventCategory.Business,
      id,
      AggregateType.Quote,
      {
        quoteId: id,
        status: updatedQuote.status,
        notes: changeNotes,
      },
      { id: userId, name: userName, role: 'Sales' },
      updatedQuote.correlationId || crypto.randomUUID(),
      causationId,
      updatedQuote.versionNumber
    );

    this.lastEventId.set(id, event.id);
    EventBus.emit(event);

    // Sync to backend asynchronously
    adminFetch(`/v1/admin/quotes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updatedQuote),
    }).catch(err => console.warn(`Failed to update quote ${id} on backend`, err));

    return updatedQuote;
  }

  // --- State Machine ---
  private static allowedTransitions: Record<QuoteStatus, QuoteStatus[]> = {
    'Draft': ['Internal Review', 'Sent to Customer', 'Cancelled'],
    'Internal Review': ['Draft', 'Sent to Customer', 'Cancelled'],
    'Sent to Customer': ['Customer Viewed', 'Customer Accepted', 'Customer Rejected', 'Expired', 'Cancelled'],
    'Customer Viewed': ['Customer Accepted', 'Customer Rejected', 'Expired', 'Cancelled'],
    'Customer Accepted': ['Converted to Order', 'Cancelled'],
    'Customer Rejected': ['Draft', 'Cancelled'],
    'Expired': ['Draft'],
    'Cancelled': [],
    'Converted to Order': [],
  };

  static updateStatus(id: string, newStatus: QuoteStatus, userId: string, userName: string, notes?: string): Quote {
    const quote = this.quotes.get(id);
    if (!quote) throw new Error(`Quote ${id} not found`);

    const allowed = this.allowedTransitions[quote.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid transition from ${quote.status} to ${newStatus}`);
    }

    const updatedQuote: Quote = {
      ...quote,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    this.quotes.set(id, updatedQuote);

    const causationId = this.lastEventId.get(id);
    const correlationId = updatedQuote.correlationId || crypto.randomUUID();
    let eventType = EventType.QuoteUpdated;

    if (newStatus === 'Sent to Customer') eventType = EventType.QuoteSent;
    else if (newStatus === 'Customer Accepted') eventType = EventType.QuoteAccepted;
    else if (newStatus === 'Customer Rejected') eventType = EventType.QuoteRejected;
    else if (newStatus === 'Expired') eventType = EventType.QuoteExpired;
    else if (newStatus === 'Cancelled') eventType = EventType.QuoteCancelled;
    else if (newStatus === 'Converted to Order') eventType = EventType.QuoteConverted;

    const payload: any = { quoteId: id };
    if (newStatus === 'Sent to Customer') payload.email = updatedQuote.email;
    if (newStatus === 'Customer Accepted') payload.customerName = updatedQuote.companyName;
    if (newStatus === 'Customer Rejected' || newStatus === 'Cancelled') payload.reason = notes;

    if (newStatus !== 'Converted to Order') {
      const event = EventFactory.createEvent(
        eventType,
        EventCategory.Business,
        id,
        AggregateType.Quote,
        payload,
        { id: userId, name: userName, role: 'Sales' },
        correlationId,
        causationId
      );

      this.lastEventId.set(id, event.id);
      EventBus.emit(event);
    }

    // Sync status change to backend
    adminFetch(`/v1/admin/quotes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, notes }),
    }).catch(err => console.warn(`Failed to update quote status ${id} on backend`, err));

    return updatedQuote;
  }

  static async sendQuote(id: string): Promise<{ quote: Quote; emailSent: boolean; warning?: string }> {
    const quote = this.quotes.get(id);
    if (!quote) throw new Error(`Quote ${id} not found`);

    const json = await adminFetch<{ success: boolean; data: any; emailSent: boolean; warning?: string }>(
      `/v1/admin/quotes/${encodeURIComponent(id)}/send`,
      { method: 'POST' }
    );

    if (json && json.success) {
      const updatedQuote: Quote = {
        ...quote,
        status: 'Sent to Customer',
        updatedAt: new Date().toISOString(),
      };
      this.quotes.set(id, updatedQuote);
      return { quote: updatedQuote, emailSent: json.emailSent, warning: json.warning };
    }
    throw new Error('Failed to send quote');
  }

  static async deleteQuote(id: string): Promise<boolean> {
    this.quotes.delete(id);
    this.revisions.delete(id);
    this.lastEventId.delete(id);

    try {
      await adminFetch(`/v1/admin/quotes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return true;
    } catch (err) {
      console.warn(`Failed to delete quote ${id} on backend`, err);
      return false;
    }
  }
}
