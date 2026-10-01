import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit,
  FileText,
  Filter,
  Mail,
  MessageSquare,
  PhoneCall,
  Search,
  Star,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  Plus,
  X,
} from 'lucide-react';
import { Quotation, leadService } from '../../services/leadService';
import { useLeads, useCRMActivities, useFollowUpTasks } from '../../hooks/queries';
import { Lead as LeadType } from '../../types';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Heading, Text } from '../../components/ui/Typography';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { PageContainer } from '../../components/layout/PageContainer';

export function LeadsManagement() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { data: leadsData, isLoading: loadingLeads, error: leadsError, refetch } = useLeads();
  const { data: activitiesData, isLoading: loadingActivities } = useCRMActivities();
  const { data: followUpsData, isLoading: loadingFollowUps } = useFollowUpTasks();

  const leads = leadsData?.data || [];
  const activities = activitiesData?.data || [];
  const followUps = followUpsData?.data || [];
  const [quotations, setQuotations] = useState<Quotation[]>([]);

  const loading = loadingLeads || loadingActivities || loadingFollowUps;
  const error = leadsError ? "Failed to load CRM data." : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadType | null>(null);

  // Add Lead Modal state
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [equipmentNeeded, setEquipmentNeeded] = useState('Smart Fryer Pro');
  const [quantity, setQuantity] = useState('2');
  const [source, setSource] = useState('Website Contact');
  const [timeline, setTimeline] = useState('Immediate (2 weeks)');
  const [message, setMessage] = useState('');

  // Note addition state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteType, setNoteType] = useState<'sales' | 'admin' | 'followUp'>('sales');
  const [noteText, setNoteText] = useState('');

  // Rep assignment modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Follow up edit state
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');

  const handleLeadSelect = async (lead: LeadType) => {
    setSelectedLead(lead);
    setIsAddingNote(false);
    setIsEditingFollowUp(false);
    try {
      const quotesRes = await leadService.getQuotationsByLead(lead.id);
      setQuotations(quotesRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const closePanel = () => {
    setSelectedLead(null);
    setIsAddingNote(false);
    setIsEditingFollowUp(false);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        searchQuery === '' ||
        lead.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.equipmentNeeded && lead.equipmentNeeded.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, searchQuery, statusFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !companyName.trim() || !email.trim()) {
      showToast('Validation Error', 'First name, company, and email are required.', 'error');
      return;
    }

    try {
      const newLeadData: Omit<LeadType, 'id'> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim() || '+91 98000 00000',
        equipmentNeeded: equipmentNeeded.trim(),
        quantity: parseInt(quantity, 10) || 1,
        source: (['Bulk Enquiry', 'Contact Form', 'Cold Call', 'Referral'].includes(source)
          ? source
          : 'Contact Form') as LeadType['source'],
        timeline: timeline.trim(),
        status: 'New',
        score: 75,
        message: message.trim() || undefined,
        assignedTo: {
          name: 'Rohan Sharma',
          email: 'rohan.s@kitchenbots.com',
          phone: '+91 98111 22233',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
          status: 'Available',
          load: 4,
        },
        notes: {
          sales: message.trim() ? [message.trim()] : [],
          admin: [],
          followUp: [],
        },
        createdAt: new Date().toISOString(),
      };

      await leadService.createLead(newLeadData);
      await refetch();

      showToast(
        'Lead Created',
        `${firstName} ${lastName} from ${companyName} has been logged.`,
        'success'
      );

      // Reset form & close modal
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setIsAddLeadModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to create lead.', 'error');
    }
  };

  const handleExportData = () => {
    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Company',
      'Email',
      'Phone',
      'Status',
      'Equipment',
      'Quantity',
      'Source',
      'Timeline',
    ];
    const rows = filteredLeads.map((l) => [
      l.id,
      `"${l.firstName}"`,
      `"${l.lastName}"`,
      `"${l.companyName}"`,
      `"${l.email}"`,
      `"${l.phone}"`,
      `"${l.status}"`,
      `"${l.equipmentNeeded || ''}"`,
      l.quantity,
      `"${l.source}"`,
      `"${l.timeline || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kitchenbots-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Export Complete', `${filteredLeads.length} leads exported to CSV.`, 'success');
  };

  const handleEmailAction = (lead: LeadType) => {
    navigator.clipboard?.writeText?.(lead.email);
    window.open(`mailto:${lead.email}`);
    showToast('Email Action', `Copied ${lead.email} and launched email client.`, 'info');
  };

  const handleCallAction = (lead: LeadType) => {
    navigator.clipboard?.writeText?.(lead.phone);
    window.open(`tel:${lead.phone}`);
    showToast('Call Action', `Dialing ${lead.phone}.`, 'info');
  };

  const handleQuoteAction = (lead: LeadType) => {
    navigate(`/admin/quotes/new?leadId=${lead.id}&company=${encodeURIComponent(lead.companyName)}`);
    closePanel();
  };

  const handleAssignRep = async (rep: { name: string; email: string; phone: string; avatar: string; status: 'Available' | 'Busy'; load: number }) => {
    if (!selectedLead) return;
    try {
      const updated = await leadService.updateLead(selectedLead.id, { assignedTo: rep });
      setSelectedLead(updated);
      await refetch();
      setIsAssignModalOpen(false);
      showToast('Rep Assigned', `Lead assigned to ${rep.name}.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to assign sales representative.', 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedLead || !noteText.trim()) return;
    try {
      const currentNotes = { ...selectedLead.notes };
      currentNotes[noteType] = [...(currentNotes[noteType] || []), noteText.trim()];

      const updated = await leadService.updateLead(selectedLead.id, { notes: currentNotes });
      setSelectedLead(updated);
      await refetch();
      setNoteText('');
      setIsAddingNote(false);
      showToast('Note Added', 'Internal note recorded successfully.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to save note.', 'error');
    }
  };

  const handleSaveFollowUp = async () => {
    if (!selectedLead || !newFollowUpDate) return;
    try {
      const updated = await leadService.updateLead(selectedLead.id, { followUpDate: newFollowUpDate });
      setSelectedLead(updated);
      await refetch();
      setIsEditingFollowUp(false);
      showToast('Follow-Up Scheduled', `Updated follow-up date to ${newFollowUpDate}.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to update follow-up date.', 'error');
    }
  };

  const handleArchiveLead = async () => {
    if (!selectedLead) return;
    try {
      await leadService.updateLeadStatus(selectedLead.id, 'Lost');
      await refetch();
      showToast('Lead Archived', `${selectedLead.firstName} ${selectedLead.lastName} moved to archived status.`, 'info');
      closePanel();
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to archive lead.', 'error');
    }
  };

  const handleConvertToCustomer = async () => {
    if (!selectedLead) return;
    try {
      await leadService.updateLeadStatus(selectedLead.id, 'Converted');
      await refetch();
      showToast('Opportunity Converted', `${selectedLead.companyName} has been converted to an active Customer!`, 'success');
      closePanel();
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to convert lead.', 'error');
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "warning" | "info" => {
    switch(status) {
      case 'New': return 'info';
      case 'Contacted': return 'default';
      case 'Requirement Gathering': return 'warning';
      case 'Proposal Sent': return 'info';
      case 'Negotiation': return 'warning';
      case 'Converted': return 'default';
      case 'Lost': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch(status) {
      case 'Converted': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Contacted': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'Proposal Sent': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Negotiation': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default: return '';
    }
  };

  const getQuoteStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "warning" | "info" => {
    switch(status) {
      case 'Draft': return 'secondary';
      case 'Sent': return 'info';
      case 'Pending': return 'warning';
      case 'Approved': return 'default';
      case 'Rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getQuoteStatusClassName = (status: string) => {
    switch(status) {
      case 'Approved': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <ErrorState message={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <PageContainer
      title="Lead Management CRM"
      description="Track enquiries, manage prospects, monitor quotations and convert opportunities."
      homeHref="/admin"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Leads' }
      ]}
      actions={
        <>
          <Button variant="outline" onClick={handleExportData} className="gap-2 cursor-pointer">
            <Download size={16} />
            Export Data
          </Button>
          <Button variant="default" onClick={() => setIsAddLeadModalOpen(true)} className="gap-2 cursor-pointer">
            <UserPlus size={16} />
            New Lead
          </Button>
        </>
      }
    >
      {/* Top Analytics Section (6 KPI Cards) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-6"
      >
        {[
          { title: 'Total Leads', value: leads.length, icon: Users, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
          { title: 'New Leads', value: leads.filter((l) => l.status === 'New').length, icon: Star, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
          { title: 'Contacted', value: leads.filter((l) => l.status === 'Contacted').length, icon: PhoneCall, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
          { title: 'Proposal Sent', value: leads.filter((l) => l.status === 'Proposal Sent').length, icon: FileText, color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
          { title: 'Converted', value: leads.filter((l) => l.status === 'Converted').length, icon: CheckCircle2, color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
          { title: 'Lost', value: leads.filter((l) => l.status === 'Lost').length, icon: XCircle, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
        ].map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <Badge variant="default" className="text-[10px]">
                  Live
                </Badge>
              </div>
              <Text variant="muted" className="text-xs font-bold uppercase tracking-wider">{stat.title}</Text>
              <Text className="text-2xl font-bold text-foreground mt-1">{stat.value}</Text>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Lead Pipeline Overview (Funnel) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 md:gap-0 justify-between items-center relative pt-4">
              <div className="hidden md:block absolute top-8 left-0 right-0 h-1 bg-border z-0"></div>

              {[
                { stage: 'New', status: 'New', color: 'border-blue-500 text-blue-500' },
                { stage: 'Contacted', status: 'Contacted', color: 'border-purple-500 text-purple-500' },
                { stage: 'Reqs', status: 'Requirement Gathering', color: 'border-amber-500 text-amber-500' },
                { stage: 'Proposal', status: 'Proposal Sent', color: 'border-indigo-500 text-indigo-500' },
                { stage: 'Negotiation', status: 'Negotiation', color: 'border-orange-500 text-orange-500' },
                { stage: 'Converted', status: 'Converted', color: 'border-emerald-500 text-emerald-500' },
              ].map((step, idx) => {
                const count = leads.filter(l => l.status === step.status).length;
                const totalActive = leads.filter(l => l.status !== 'Lost').length || 1;
                const percent = Math.round((count / totalActive) * 100) + '%';

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === step.status ? 'All' : step.status)}
                    className="relative z-10 flex flex-col items-center bg-card px-4 cursor-pointer hover:opacity-80 transition-opacity"
                    title={`Filter by ${step.stage}`}
                  >
                    <div className={`w-14 h-14 rounded-full border-2 ${step.color} flex flex-col items-center justify-center bg-card shadow-2xs mb-2.5`}>
                      <span className="text-base font-bold text-foreground">{count}</span>
                    </div>
                    <Text className="text-xs font-semibold uppercase tracking-wide">{step.stage}</Text>
                    <Text variant="muted" className="text-xs mt-1">{percent} of total</Text>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Four-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">

        {/* Left Column (Table) - 75% */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-3 min-w-0 flex flex-col gap-6"
        >
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CardTitle>Active Leads ({filteredLeads.length})</CardTitle>
                  {statusFilter !== 'All' && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      Filtered: {statusFilter}
                      <button onClick={() => setStatusFilter('All')} className="hover:text-foreground cursor-pointer">
                        <X size={12} />
                      </button>
                    </Badge>
                  )}
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                    <Input
                      type="text"
                      placeholder="Search leads, companies..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-64 text-xs h-9"
                    />
                  </div>
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="gap-2 h-9 text-xs cursor-pointer"
                  >
                    <Filter size={14} />
                    <span className="hidden sm:inline">Filters</span>
                  </Button>
                </div>
              </div>

              {showFilters && (
                <div className="pt-3 border-t border-border mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground font-semibold mr-1">Status:</span>
                  {[
                    'All',
                    'New',
                    'Contacted',
                    'Requirement Gathering',
                    'Proposal Sent',
                    'Negotiation',
                    'Converted',
                    'Lost',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        statusFilter === s
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Lead Info</TableHead>
                    <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Source</TableHead>
                    <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Requirements</TableHead>
                    <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Status</TableHead>
                    <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                        No leads matching your current criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/40 border-b border-border/50"
                        onClick={() => handleLeadSelect(lead)}
                      >
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {lead.firstName[0]}{lead.lastName[0]}
                            </div>
                            <div>
                              <Text className="font-semibold text-foreground text-sm">{lead.firstName} {lead.lastName}</Text>
                              <Text variant="muted" className="text-xs truncate max-w-[140px]">{lead.companyName}</Text>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="secondary" className="font-medium text-xs">
                            {lead.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <Text className="text-sm text-foreground truncate max-w-[150px]">{lead.equipmentNeeded}</Text>
                          <Text variant="muted" className="text-xs">Qty: {lead.quantity}</Text>
                        </TableCell>
                        <TableCell className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            variant={getStatusBadgeVariant(lead.status)}
                            className={getStatusBadgeClassName(lead.status)}
                          >
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-4 py-3 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); handleLeadSelect(lead); }}
                            title="Inspect Lead"
                          >
                            <ChevronRight size={16} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </motion.div>

        {/* Right Column (Widgets) - 25% */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-1 min-w-0 flex flex-col gap-6"
        >

          {/* CRM Activity Timeline */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Live Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                {activities.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{activity.type}</p>
                      <p className="text-muted-foreground text-[11px] truncate">{activity.message}</p>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">{activity.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Follow-Up Schedule Widget */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar size={16} className="text-blue-500" />
                  Follow-Ups
                </CardTitle>
                <span className="text-xs text-muted-foreground font-medium">{followUps.length} scheduled</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {followUps.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-foreground truncate">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{task.leadName || task.type}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {task.date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Centered Lead Detail Modal */}
      <Drawer
        isOpen={!!selectedLead}
        onClose={closePanel}
        position="center"
        size="lg"
        title={selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "Lead Details"}
        description={selectedLead?.companyName}
        footer={
          <div className="flex justify-between items-center w-full">
            <Button
              variant="outline"
              onClick={handleArchiveLead}
              className="cursor-pointer text-xs hover:text-destructive"
            >
              Archive Lead
            </Button>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                onClick={closePanel}
                className="cursor-pointer text-xs"
              >
                Close
              </Button>
              <Button
                variant="default"
                onClick={handleConvertToCustomer}
                className="cursor-pointer text-xs gap-1.5"
              >
                <CheckCircle2 size={14} />
                Convert to Customer
              </Button>
            </div>
          </div>
        }
      >
        {selectedLead && (
          <div className="space-y-6">

            {/* Status Header */}
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-border flex items-center justify-center font-bold text-xl">
                  {selectedLead.firstName[0]}{selectedLead.lastName[0]}
                </div>
                <div>
                   {selectedLead.score !== undefined && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase">Lead Score</span>
                        <span className={`text-sm font-bold ${selectedLead.score >= 80 ? 'text-emerald-500' : selectedLead.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {selectedLead.score}/100
                        </span>
                      </div>
                    )}
                   <Badge
                      variant={getStatusBadgeVariant(selectedLead.status)}
                      className={getStatusBadgeClassName(selectedLead.status)}
                    >
                      {selectedLead.status}
                    </Badge>
                </div>
              </div>
            </div>

            {/* Quick Actions with Functional Handlers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => handleEmailAction(selectedLead)}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition-colors cursor-pointer"
                title="Send email to lead"
              >
                <Mail size={18} className="mb-2 text-primary" />
                <span className="text-xs font-medium">Email</span>
              </button>
              <button
                type="button"
                onClick={() => handleCallAction(selectedLead)}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition-colors cursor-pointer"
                title="Initiate phone call"
              >
                <PhoneCall size={18} className="mb-2 text-emerald-500" />
                <span className="text-xs font-medium">Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuoteAction(selectedLead)}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition-colors cursor-pointer"
                title="Generate quotation proposal"
              >
                <FileText size={18} className="mb-2 text-purple-500" />
                <span className="text-xs font-medium">Create Quote</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(true)}
                className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-muted/50 text-foreground transition-colors cursor-pointer"
                title="Reassign sales representative"
              >
                <UserCheck size={18} className="mb-2 text-amber-500" />
                <span className="text-xs font-medium">Assign Rep</span>
              </button>
            </div>

            {/* Contact & Business Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Heading level="h4" className="text-sm font-semibold mb-3 uppercase tracking-wider text-foreground">Contact Info</Heading>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Email</Text>
                    <Text className="text-sm font-medium text-foreground">{selectedLead.email}</Text>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Phone</Text>
                    <Text className="text-sm font-medium text-foreground">{selectedLead.phone}</Text>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Source</Text>
                    <Text className="text-sm font-medium text-foreground">{selectedLead.source}</Text>
                  </div>
                </div>
              </div>
              <div>
                <Heading level="h4" className="text-sm font-semibold mb-3 uppercase tracking-wider text-foreground">Requirements</Heading>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Equipment</Text>
                    <Text className="text-sm font-medium text-foreground truncate max-w-[150px]">{selectedLead.equipmentNeeded}</Text>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Quantity</Text>
                    <Text className="text-sm font-medium text-foreground">{selectedLead.quantity} Units</Text>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Timeline</Text>
                    <Text className="text-sm font-medium text-foreground">{selectedLead.timeline}</Text>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border">
                    <Text variant="muted" className="text-xs">Follow-up</Text>
                    <div className="flex items-center gap-2">
                      {isEditingFollowUp ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={newFollowUpDate}
                            onChange={(e) => setNewFollowUpDate(e.target.value)}
                            className="text-xs px-2 py-1 rounded border border-input bg-background text-foreground"
                          />
                          <Button size="sm" onClick={handleSaveFollowUp} className="h-6 px-2 text-[10px]">
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setIsEditingFollowUp(false)} className="h-6 px-1 text-[10px]">
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Text className="text-sm font-medium text-primary">
                            {selectedLead.followUpDate ? new Date(selectedLead.followUpDate).toLocaleDateString() : 'Unscheduled'}
                          </Text>
                          <button
                            type="button"
                            onClick={() => {
                              setNewFollowUpDate(selectedLead.followUpDate || '');
                              setIsEditingFollowUp(true);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            title="Edit follow-up date"
                          >
                            <Edit size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message */}
            {selectedLead.message && (
              <div>
                <Heading level="h4" className="text-sm font-semibold mb-2 uppercase tracking-wider text-foreground">Message</Heading>
                <div className="p-4 bg-muted/30 rounded-lg text-sm text-foreground/90 italic border border-border">
                  "{selectedLead.message}"
                </div>
              </div>
            )}

            {/* Sales Owner Widget */}
            {selectedLead.assignedTo && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Heading level="h4" className="text-sm font-semibold uppercase tracking-wider text-foreground">Assigned Rep</Heading>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="text-xs text-primary hover:text-primary/80 h-7"
                  >
                    Change Rep
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-lg shadow-xs">
                  <div className="flex items-center gap-3">
                    <img src={selectedLead.assignedTo.avatar} alt="rep" className="w-10 h-10 rounded-full border border-border object-cover" />
                    <div>
                      <Text className="text-sm font-bold text-foreground">{selectedLead.assignedTo.name}</Text>
                      <Text variant="muted" className="text-xs">{selectedLead.assignedTo.email}</Text>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                      selectedLead.assignedTo.status === 'Available' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                      {selectedLead.assignedTo.status}
                    </span>
                    <Text variant="muted" className="text-xs mt-1">Load: {selectedLead.assignedTo.load} leads</Text>
                  </div>
                </div>
              </div>
            )}

            {/* Quotations Widget */}
            {quotations.length > 0 && (
              <div>
                <Heading level="h4" className="text-sm font-semibold mb-3 uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <FileText size={16} /> Quotations
                </Heading>
                <div className="space-y-3">
                  {quotations.map(quote => (
                    <div key={quote.id} className="flex items-center justify-between p-4 bg-muted/20 border border-border rounded-xl">
                      <div>
                        <Text className="text-sm font-bold text-foreground">{quote.id}</Text>
                        <Text variant="muted" className="text-xs mt-1">Date: {new Date(quote.date).toLocaleDateString()}</Text>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <Text className="text-sm font-bold text-foreground">₹{quote.value.toLocaleString('en-IN')}</Text>
                        <Badge
                          variant={getQuoteStatusVariant(quote.status)}
                          className={`mt-1 ${getQuoteStatusClassName(quote.status)}`}
                        >
                          {quote.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Notes */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Heading level="h4" className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2 text-foreground">
                  <MessageSquare size={16} /> Internal Notes
                </Heading>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="text-primary hover:text-primary/80 gap-1 h-8 cursor-pointer"
                >
                  <Plus size={14}/> Add Note
                </Button>
              </div>

              {isAddingNote && (
                <div className="p-3 bg-muted/30 border border-border rounded-lg mb-3 space-y-2.5">
                  <div className="flex gap-2">
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value as any)}
                      className="text-xs px-2.5 py-1.5 rounded-md border border-input bg-background text-foreground"
                    >
                      <option value="sales">Sales Note</option>
                      <option value="admin">Admin Note</option>
                      <option value="followUp">Follow-Up Note</option>
                    </select>
                  </div>
                  <Input
                    placeholder="Enter confidential internal note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddingNote(false);
                        setNoteText('');
                      }}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveNote}
                      className="text-xs h-7"
                    >
                      Save Note
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {selectedLead.notes.sales.map((note, idx) => (
                  <div key={idx} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <span className="block text-xs font-semibold text-blue-500 dark:text-blue-400 mb-1">Sales Note</span>
                    <p className="text-sm text-foreground">{note}</p>
                  </div>
                ))}
                {selectedLead.notes.admin.map((note, idx) => (
                  <div key={idx} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <span className="block text-xs font-semibold text-purple-500 dark:text-purple-400 mb-1">Admin Note</span>
                    <p className="text-sm text-foreground">{note}</p>
                  </div>
                ))}
                {selectedLead.notes.followUp.map((note, idx) => (
                  <div key={idx} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="block text-xs font-semibold text-amber-500 dark:text-amber-400 mb-1">Follow Up</span>
                    <p className="text-sm text-foreground">{note}</p>
                  </div>
                ))}
                {selectedLead.notes.sales.length === 0 && selectedLead.notes.admin.length === 0 && selectedLead.notes.followUp.length === 0 && (
                  <Text variant="muted" className="text-sm italic text-center py-4">No notes added yet.</Text>
                )}
              </div>
            </div>

          </div>
        )}
      </Drawer>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isAddLeadModalOpen}
        onClose={() => setIsAddLeadModalOpen(false)}
        title="Add New Commercial Lead"
        description="Record potential kitchen robotics clients and requirement specifications."
      >
        <form onSubmit={handleCreateLead} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">First Name *</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Vikram"
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Last Name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Seth"
                className="text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Company / Restaurant Name *</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Metro Cloud Kitchens"
              className="text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Email Address *</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operations@company.com"
                className="text-xs"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phone Number</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Equipment Needed</label>
              <select
                value={equipmentNeeded}
                onChange={(e) => setEquipmentNeeded(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden"
              >
                <option value="Smart Fryer Pro">Smart Fryer Pro</option>
                <option value="Auto-Wok 3000">Auto-Wok 3000</option>
                <option value="GrillMaster 3000 PRO">GrillMaster 3000 PRO</option>
                <option value="SteamPro Commercial Oven">SteamPro Commercial Oven</option>
                <option value="CoolFreeze Industrial">CoolFreeze Industrial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Quantity</label>
              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Acquisition Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden"
              >
                <option value="Website Contact">Website Contact</option>
                <option value="Inbound Call">Inbound Call</option>
                <option value="Referral">Referral</option>
                <option value="Trade Show">Trade Show</option>
                <option value="Partner Network">Partner Network</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Timeline</label>
              <select
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden"
              >
                <option value="Immediate (2 weeks)">Immediate (2 weeks)</option>
                <option value="1 Month">1 Month</option>
                <option value="Next Quarter">Next Quarter</option>
                <option value="Budget Exploration">Budget Exploration</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Initial Enquiry / Requirements Note</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Looking for automated frying unit with digital oil filtration"
              className="text-xs"
            />
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddLeadModalOpen(false)}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="cursor-pointer text-xs gap-1.5"
            >
              <UserPlus size={14} />
              Save Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Rep Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Sales Representative"
        description="Select an account executive to manage this commercial opportunity."
      >
        <div className="space-y-3 py-2">
          {[
            {
              name: 'Rohan Sharma',
              email: 'rohan.s@kitchenbots.com',
              phone: '+91 98111 22233',
              avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
              status: 'Available' as const,
              load: 4,
            },
            {
              name: 'Priya Kapoor',
              email: 'priya.k@kitchenbots.com',
              phone: '+91 98222 33445',
              avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
              status: 'Available' as const,
              load: 3,
            },
            {
              name: 'Vikram Khanna',
              email: 'vikram.k@kitchenbots.com',
              phone: '+91 98333 44556',
              avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
              status: 'Busy' as const,
              load: 7,
            },
          ].map((rep) => (
            <div
              key={rep.email}
              onClick={() => handleAssignRep(rep)}
              className="p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <img src={rep.avatar} alt={rep.name} className="w-9 h-9 rounded-full object-cover border border-border" />
                <div>
                  <p className="text-xs font-bold text-foreground">{rep.name}</p>
                  <p className="text-[11px] text-muted-foreground">{rep.email}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                  rep.status === 'Available' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  {rep.status}
                </span>
                <p className="text-[10px] text-muted-foreground mt-0.5">{rep.load} leads</p>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </PageContainer>
  );
}

export default LeadsManagement;
