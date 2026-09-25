import { Lead } from '../types';
import { PaginationParams, PaginatedResponse } from '../services/types';
import { adminFetch } from './adminClient';

export interface Quotation {
  id: string;
  leadId: string;
  value: number;
  status: 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired';
  date: string;
  lastUpdated: string;
}

export interface CRMActivity {
  id: string;
  type: 'Call' | 'Meeting' | 'Proposal' | 'Enquiry' | 'Note' | 'Conversion';
  message: string;
  timestamp: string;
  user?: {
    name: string;
    avatar: string;
  };
}

export interface FollowUpTask {
  id: string;
  title: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Task';
  date: string;
  time: string;
  leadId?: string;
  leadName?: string;
}

export const INITIAL_LEADS: Lead[] = [];
export const INITIAL_FOLLOW_UP_TASKS: FollowUpTask[] = [];
export const INITIAL_CRM_ACTIVITIES: CRMActivity[] = [];

export function mapFirestoreEnquiryToLead(raw: any): Lead {
  const firstName = raw.firstName || (raw.name ? raw.name.split(' ')[0] : 'Prospect');
  const lastName = raw.lastName || (raw.name && raw.name.split(' ').length > 1 ? raw.name.split(' ').slice(1).join(' ') : 'Customer');
  const companyName = raw.company || raw.companyName || (raw.organization ? raw.organization : 'Direct Enquiry');
  const email = raw.email || 'enquiry@kitchenbots.com';
  const phone = raw.phone || '+91 9490701421';

  let source: 'Bulk Enquiry' | 'Contact Form' | 'Cold Call' | 'Referral' = 'Contact Form';
  if (raw.source === 'bulk' || raw.source === 'Bulk Enquiry' || (raw.items && raw.items.length > 0)) {
    source = 'Bulk Enquiry';
  } else if (raw.source === 'Referral') {
    source = 'Referral';
  } else if (raw.source === 'Cold Call') {
    source = 'Cold Call';
  }

  let status: Lead['status'];
  const rawStatus = (raw.status || '').toLowerCase();
  if (rawStatus === 'contacted') status = 'Contacted';
  else if (rawStatus === 'requirement gathering' || rawStatus === 'in_progress') status = 'Requirement Gathering';
  else if (rawStatus === 'proposal sent' || rawStatus === 'quoted') status = 'Proposal Sent';
  else if (rawStatus === 'negotiation') status = 'Negotiation';
  else if (rawStatus === 'converted' || rawStatus === 'won') status = 'Converted';
  else if (rawStatus === 'lost' || rawStatus === 'closed') status = 'Lost';
  else status = 'New';

  const equipmentNeeded = raw.equipmentNeeded || (raw.items && raw.items.length > 0
    ? raw.items.map((i: any) => `${i.productId || 'Equipment'} (${i.quantity || 1})`).join(', ')
    : raw.productName || raw.message || 'Commercial Kitchen Equipment');

  const quantity = Number(raw.quantity || (raw.items && raw.items.length > 0 ? raw.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 1));

  return {
    id: raw.id,
    source,
    firstName,
    lastName,
    companyName,
    email,
    phone,
    equipmentNeeded,
    quantity,
    timeline: raw.timeline || 'Immediate',
    message: raw.message || 'Customer submitted enquiry via website.',
    status,
    score: Number(raw.score || (source === 'Bulk Enquiry' ? 90 : 75)),
    followUpDate: raw.followUpDate || raw.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    assignedTo: raw.assignedTo || {
      name: 'Operations Team',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
      email: 'ops@kitchenbots.com',
      phone: '+91 9490701421',
      load: 1,
      status: 'Available',
    },
    notes: raw.notes || {
      sales: raw.message ? [raw.message] : ['Inbound enquiry from website'],
      admin: raw.reference ? [`Reference: ${raw.reference}`] : [],
      followUp: ['Initial customer outreach required'],
    },
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

let localLeads: Lead[] = [];

export const leadsApi = {
  getLeads: async (params?: PaginationParams): Promise<PaginatedResponse<Lead>> => {
    let records: Lead[] = [];
    try {
      const json = await adminFetch<{ success: boolean; data: any[] }>('/v1/admin/enquiries');
      if (json && json.success && Array.isArray(json.data)) {
        localLeads = json.data.map(mapFirestoreEnquiryToLead);
        records = [...localLeads];
      }
    } catch (err) {
      console.error('[leadsApi.getLeads Error]', err);
    }

    if (records.length === 0) {
      records = [...localLeads];
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      records = records.filter(
        (l) =>
          l.firstName.toLowerCase().includes(q) ||
          l.lastName.toLowerCase().includes(q) ||
          l.companyName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.equipmentNeeded && l.equipmentNeeded.toLowerCase().includes(q))
      );
    }
    if (params?.status && params.status !== 'All') {
      records = records.filter((l) => l.status === params.status);
    }
    if (params?.source && params.source !== 'All') {
      records = records.filter((l) => l.source === params.source);
    }

    const total = records.length;
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      records = records.slice(start, start + params.limit);
    }
    return { data: records, total };
  },

  getLeadById: async (id: string): Promise<Lead> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/enquiries/${encodeURIComponent(id)}`);
      if (json && json.success && json.data) {
        return mapFirestoreEnquiryToLead(json.data);
      }
    } catch (err) {
      console.error(`[leadsApi.getLeadById Error] ${id}:`, err);
    }

    const lead = localLeads.find((l) => l.id === id);
    if (!lead) throw new Error(`Lead ${id} not found`);
    return lead;
  },

  createLead: async (data: Omit<Lead, 'id'>): Promise<Lead> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>('/v1/admin/enquiries', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (json && json.success && json.data) {
        const mapped = mapFirestoreEnquiryToLead(json.data);
        localLeads.unshift(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('[leadsApi.createLead] Backend fetch skipped or failed, persisting locally:', (err as any)?.message || err);
    }

    const newLead: Lead = {
      ...data,
      id: `enq-${Date.now()}`,
      notes: data.notes || { sales: [], admin: [], followUp: [] },
    };
    localLeads.unshift(newLead);
    return newLead;
  },

  updateLead: async (id: string, data: Partial<Lead>): Promise<Lead> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/enquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      if (json && json.success && json.data) {
        return mapFirestoreEnquiryToLead(json.data);
      }
    } catch (err) {
      console.error(`[leadsApi.updateLead Error] ${id}:`, err);
    }

    const index = localLeads.findIndex((l) => l.id === id);
    if (index === -1) throw new Error(`Lead ${id} not found`);
    localLeads[index] = { ...localLeads[index], ...data };
    return localLeads[index];
  },

  updateLeadStatus: async (id: string, status: Lead['status']): Promise<Lead> => {
    try {
      const json = await adminFetch<{ success: boolean; data: any }>(`/v1/admin/enquiries/${encodeURIComponent(id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (json && json.success && json.data) {
        return mapFirestoreEnquiryToLead(json.data);
      }
    } catch (err) {
      console.error(`[leadsApi.updateLeadStatus Error] ${id}:`, err);
    }

    const index = localLeads.findIndex((l) => l.id === id);
    if (index === -1) throw new Error(`Lead ${id} not found`);
    localLeads[index] = { ...localLeads[index], status };
    return localLeads[index];
  },

  getQuotationsByLead: async (_leadId: string, _params?: PaginationParams): Promise<PaginatedResponse<Quotation>> => {
    return { data: [], total: 0 };
  },

  getCRMActivities: async (_params?: PaginationParams): Promise<PaginatedResponse<CRMActivity>> => {
    const activities: CRMActivity[] = localLeads.slice(0, 10).map((lead, idx) => ({
      id: `act-${lead.id || idx}`,
      type: lead.status === 'Converted' ? 'Conversion' : lead.status === 'Proposal Sent' ? 'Proposal' : 'Enquiry',
      message: `${lead.companyName || `${lead.firstName} ${lead.lastName}`} (${lead.equipmentNeeded || 'Equipment enquiry'}) - Status: ${lead.status}`,
      timestamp: lead.createdAt || 'Recently',
      user: {
        name: lead.assignedTo?.name || 'Commercial Admin',
        avatar: lead.assignedTo?.avatar || '',
      },
    }));
    return { data: activities, total: activities.length };
  },

  getFollowUpTasks: async (_params?: PaginationParams): Promise<PaginatedResponse<FollowUpTask>> => {
    const tasks: FollowUpTask[] = localLeads
      .filter((l) => l.status !== 'Converted' && l.status !== 'Lost')
      .slice(0, 10)
      .map((lead, idx) => ({
        id: `task-${lead.id || idx}`,
        title: `Follow up with ${lead.firstName} ${lead.lastName} (${lead.companyName})`,
        type: 'Call',
        date: lead.followUpDate || 'Pending',
        time: '11:00 AM',
        leadId: lead.id,
        leadName: lead.companyName || `${lead.firstName} ${lead.lastName}`,
      }));
    return { data: tasks, total: tasks.length };
  },
};
