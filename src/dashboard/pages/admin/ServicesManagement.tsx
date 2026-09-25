import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Plus,
  Ticket,
  Wrench,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Search,
  MapPin,
} from 'lucide-react';
import { ticketService, ServiceTicket } from '../../services/ticketService';
import { ErrorState } from '../../components/common/ErrorState';
import { useToast } from '../../context/ToastContext';

import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Text } from '../../components/ui/Typography';
import { PageContainer } from '../../components/layout/PageContainer';

export const ServicesManagement = () => {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Ticket Modal State
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [productName, setProductName] = useState('Smart Fryer Pro');
  const [engineerName, setEngineerName] = useState('Vikram R.');
  const [isUrgent, setIsUrgent] = useState(false);

  // Engineer Map Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ticketService.getTickets({
        status: statusFilter !== 'All Status' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setTickets(response.data);
      setTotalCount(response.total);
    } catch (err) {
      console.error('Error fetching tickets', err);
      setError('Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !productName.trim()) {
      showToast('Validation Error', 'Customer and equipment name are required.', 'error');
      return;
    }

    try {
      const initials = customerName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const newTicket = await ticketService.createTicket({
        customerName: customerName.trim(),
        customerInitials: initials || 'KB',
        customerColor: 'bg-primary/10 text-primary',
        productName: productName.trim(),
        engineerName,
        engineerColor: 'bg-emerald-500',
        status: 'Open',
        date: 'Just now',
        isUrgent,
      });

      setTickets((prev) => [newTicket, ...prev]);
      setTotalCount((prev) => prev + 1);
      setIsNewTicketModalOpen(false);
      setCustomerName('');
      setIsUrgent(false);

      showToast('Ticket Created', `Service ticket #${newTicket.id} has been registered.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to create ticket.', 'error');
    }
  };

  const handleCycleStatus = async (ticket: ServiceTicket) => {
    const nextStatusMap: Record<ServiceTicket['status'], ServiceTicket['status']> = {
      Open: 'In Progress',
      Assigned: 'In Progress',
      'In Progress': 'Completed',
      Completed: 'Resolved',
      Resolved: 'Open',
    };
    const newStatus = nextStatusMap[ticket.status];

    try {
      await ticketService.updateTicketStatus(ticket.id, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t))
      );
      showToast('Status Updated', `Ticket #${ticket.id} marked as ${newStatus}.`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Error', 'Failed to update ticket status.', 'error');
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "warning" | "info" => {
    switch(status) {
      case 'Open': return 'destructive';
      case 'In Progress': return 'info';
      case 'Assigned': return 'warning';
      case 'Completed': return 'default';
      default: return 'secondary';
    }
  };

  const openCount = tickets.filter((t) => t.status === 'Open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'In Progress').length;
  const assignedCount = tickets.filter((t) => t.status === 'Assigned').length;
  const completedCount = tickets.filter((t) => t.status === 'Completed').length;

  const paginatedTickets = tickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.max(1, Math.ceil(tickets.length / itemsPerPage));

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
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <PageContainer
      title="Service Management"
      description="Manage service tickets, track engineers, and monitor resolution metrics."
      homeHref="/admin"
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Services' }
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsMapModalOpen(true)}
            className="gap-1.5 text-xs font-medium cursor-pointer h-9 px-3"
          >
            <MapPin size={14} className="text-primary" />
            <span className="hidden sm:inline">Engineer Radar</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setIsNewTicketModalOpen(true)}
            className="gap-1.5 text-xs font-semibold cursor-pointer h-9 px-3.5 shadow-sm"
          >
            <Plus size={15} />
            <span>New Ticket</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Analytics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Ticket size={20} />
                </div>
                <Badge variant="warning">Open</Badge>
              </div>
              <Text variant="muted" className="text-[11px] font-bold uppercase tracking-wider">Open Tickets</Text>
              <div className="text-3xl font-extrabold tracking-tight text-foreground mt-1">{openCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Awaiting technician assignment</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Wrench size={20} />
                </div>
                <Badge variant="info">In Progress</Badge>
              </div>
              <Text variant="muted" className="text-[11px] font-bold uppercase tracking-wider">Active Services</Text>
              <div className="text-3xl font-extrabold tracking-tight text-foreground mt-1">{inProgressCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Under active diagnostic/repair</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Clock size={20} />
                </div>
                <Badge variant="secondary">Assigned</Badge>
              </div>
              <Text variant="muted" className="text-[11px] font-bold uppercase tracking-wider">Assigned Engineers</Text>
              <div className="text-3xl font-extrabold tracking-tight text-foreground mt-1">{assignedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Field personnel dispatched on site</p>
            </CardContent>
          </Card>

          <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={20} />
                </div>
                <Badge variant="default">Resolved</Badge>
              </div>
              <Text variant="muted" className="text-[11px] font-bold uppercase tracking-wider">Completed Tickets</Text>
              <div className="text-3xl font-extrabold tracking-tight text-foreground mt-1">{completedCount}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Resolved within SLA targets</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Two Columns Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* Main Table Column (75% / cols 1-3) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3 min-w-0"
          >
            <Card className="overflow-hidden flex flex-col">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle>Service Records</CardTitle>

                  {/* Toolbar */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                      <Input
                        type="text"
                        placeholder="Search tickets, customers, equipment..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-full sm:w-64 text-xs h-9"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-9 px-3 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden"
                    >
                      <option value="All Status">All Status</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Assigned">Assigned</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Ticket ID</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Client / Restaurant</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Equipment Model</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Assigned Field Tech</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Status (Click to toggle)</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold">Date</TableHead>
                      <TableHead className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                          No service tickets found matching your query.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className="hover:bg-muted/40 border-b border-border/50 cursor-pointer"
                          onClick={() => handleCycleStatus(ticket)}
                        >
                          <TableCell className="font-mono text-xs font-semibold text-primary px-4 py-3 whitespace-nowrap">
                            #{ticket.id}
                            {ticket.isUrgent && (
                              <span className="ml-1.5 text-[9px] font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1 py-0.5 rounded">
                                Urgent
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {ticket.customerAvatar ? (
                                <img alt="Client Avatar" className="w-8 h-8 rounded-full object-cover shrink-0" src={ticket.customerAvatar} />
                              ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${ticket.customerColor}`}>
                                  {ticket.customerInitials}
                                </div>
                              )}
                              <Text className="font-medium text-foreground text-sm truncate max-w-[140px]">{ticket.customerName}</Text>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <Text className="text-sm text-muted-foreground truncate max-w-[140px]">{ticket.productName}</Text>
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${ticket.engineerColor}`}></div>
                              <Text className="text-sm text-foreground">{ticket.engineerName}</Text>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              variant={getStatusVariant(ticket.status)}
                              className="cursor-pointer hover:opacity-80"
                              title="Click to advance status"
                            >
                              {ticket.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 whitespace-nowrap">
                            <Text className="text-sm text-muted-foreground">{ticket.date}</Text>
                          </TableCell>
                          <TableCell className="text-right px-4 py-3 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCycleStatus(ticket);
                              }}
                              title="Advance status"
                              aria-label={`Advance status for ticket #${ticket.id}`}
                            >
                              <MoreVertical size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="p-4 border-t border-border flex items-center justify-between">
                <Text variant="muted" className="text-sm font-medium">
                  {tickets.length === 0
                    ? 'Showing 0 tickets'
                    : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, tickets.length)} of ${totalCount || tickets.length} tickets`}
                </Text>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 cursor-pointer"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <Button
                      key={idx}
                      variant={currentPage === idx + 1 ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0 cursor-pointer"
                      onClick={() => setCurrentPage(idx + 1)}
                    >
                      {idx + 1}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 cursor-pointer"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Right Sidebar (25% / col 4) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-1 min-w-0 flex flex-col gap-6"
          >
            {/* Urgent Requests Widget */}
            <Card className="border-l-4 border-l-rose-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                    <span>Urgent Requests</span>
                  </CardTitle>
                  <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400">
                    2 High
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div
                    onClick={() => setSearchQuery('Main Freezer Leak')}
                    className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 cursor-pointer hover:bg-rose-500/15 transition-colors"
                    title="Click to view this ticket"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <Text className="font-bold text-foreground text-sm truncate">Main Freezer Leak</Text>
                      <span className="text-[10px] font-bold text-rose-500 px-2 py-0.5 bg-background border border-rose-200 dark:border-rose-800 rounded-md shrink-0">0:14:22</span>
                    </div>
                    <Text variant="muted" className="text-xs truncate">Cloud Kitchen Delhi-NSR</Text>
                  </div>
                  <div
                    onClick={() => setSearchQuery('Gas Range Component')}
                    className="p-3 bg-muted/20 rounded-xl border border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    title="Click to view this ticket"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <Text className="font-bold text-foreground text-sm truncate">Gas Range Component</Text>
                      <span className="text-[10px] font-bold text-amber-500 px-2 py-0.5 bg-background border border-border rounded-md shrink-0">1:02:45</span>
                    </div>
                    <Text variant="muted" className="text-xs truncate">Pizza Planet, G-Block</Text>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Engineer Schedules Widget */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Engineer Schedules</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMapModalOpen(true)}
                    className="text-primary hover:text-primary/80 h-auto p-0 text-xs font-medium cursor-pointer"
                  >
                    View Map
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['Vikram R.', 'Priya D.', 'Amit K.'].map((engName, idx) => {
                    const activeTicket = tickets.find(
                      (t) => t.engineerName === engName && t.status !== 'Completed' && t.status !== 'Resolved'
                    );
                    const locationStatus = activeTicket ? `At ${activeTicket.customerName}` : (idx === 2 ? 'Offline' : 'On Route');
                    const statusBg = activeTicket ? 'bg-green-500' : (idx === 2 ? 'bg-slate-400' : 'bg-yellow-500');
                    const opacityClass = !activeTicket && idx === 2 ? 'opacity-50' : '';
                    const avatarUrl = idx === 0
                      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100'
                      : idx === 1
                      ? 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100'
                      : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100';

                    return (
                      <div key={engName} className={`flex items-center justify-between ${opacityClass}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            alt="Engineer Avatar"
                            className="w-9 h-9 rounded-full object-cover shrink-0"
                            src={avatarUrl}
                          />
                          <div className="min-w-0">
                            <Text className="font-bold text-foreground text-sm truncate">{engName}</Text>
                            <Text variant="muted" className="text-[10px] uppercase tracking-wider truncate">{locationStatus}</Text>
                          </div>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${statusBg} shrink-0`}></span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Support Activity Feed */}
            <Card className="flex-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Support Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                  {tickets.slice(0, 3).map((ticket, i) => (
                    <div key={ticket.id || i} className="relative pl-7">
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center border-4 border-background shadow-xs`}>
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <Text className="text-sm text-foreground">
                        <span className="font-bold">#{ticket.id}</span> ({ticket.customerName}) - {ticket.status}
                      </Text>
                      <Text variant="muted" className="text-[10px] mt-0.5">{ticket.date || 'Recently updated'}</Text>
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <div className="text-xs text-muted-foreground py-2">No recent support activity.</div>
                  )}
                </div>
              </CardContent>
            </Card>

          </motion.div>
        </div>
      </div>

      {/* New Service Ticket Modal */}
      <Modal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        title="Create Service Ticket"
        description="Dispatch a field maintenance engineer to service commercial kitchen machinery."
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewTicketModalOpen(false)}
              className="text-xs cursor-pointer h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-service-ticket-form"
              size="sm"
              className="text-xs gap-1.5 cursor-pointer h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold"
            >
              <Plus size={14} />
              Dispatch Ticket
            </Button>
          </div>
        }
      >
        <form id="create-service-ticket-form" onSubmit={handleCreateTicket} className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Client / Restaurant Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Royal Tandoor"
              className="text-xs h-10"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Equipment Model <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring appearance-none pr-8 cursor-pointer"
              >
                <option value="Commercial BBQ Grill">Commercial BBQ Grill</option>
                <option value="Rocket Stove (Single Burner)">Rocket Stove (Single Burner)</option>
                <option value="Food Processing Machine">Food Processing Machine</option>
                <option value="Street Food Griddle">Street Food Griddle</option>
                <option value="Flip BBQ Height Adjustable">Flip BBQ Height Adjustable</option>
                <option value="Collapsible BBQ Large">Collapsible BBQ Large</option>
                <option value="Industrial 4-Burner Gas Range">Industrial 4-Burner Gas Range</option>
                <option value="Commercial Exhaust Hood 6ft">Commercial Exhaust Hood 6ft</option>
                <option value="Smart Fryer Pro">Smart Fryer Pro</option>
                <option value="Auto-Wok 3000">Auto-Wok 3000</option>
                <option value="SteamPro Commercial Oven">SteamPro Commercial Oven</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Assigned Field Technician
            </label>
            <div className="relative">
              <select
                value={engineerName}
                onChange={(e) => setEngineerName(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring appearance-none pr-8 cursor-pointer"
              >
                <option value="Vikram R.">Vikram R. (Available - North Zone)</option>
                <option value="Priya D.">Priya D. (En Route - Central Hub)</option>
                <option value="Amit K.">Amit K. (Available - West Hub)</option>
                <option value="Rajesh M.">Rajesh M. (On Duty - South Hub)</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                id="urgent-checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="rounded border-input text-primary focus:ring-ring h-4 w-4 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Mark as High-Priority Urgent Request
                  </span>
                  {isUrgent && (
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5">
                      SLA &lt; 2h
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sends immediate priority alert to the nearest active field engineer.
                </p>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      {/* Field Engineer Live Map Modal */}
      <Modal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        title="Field Engineer Live Routes & Regional Hubs"
        description="Real-time dispatch telemetry across metro commercial kitchens."
      >
        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Bengaluru Tech Hub
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge>
            </div>
            <div className="text-xs space-y-1.5 text-muted-foreground">
              <p><strong className="text-foreground">Vikram R.:</strong> On-site at Royal Tandoor (Indiranagar)</p>
              <p><strong className="text-foreground">Priya D.:</strong> En route to Cloud Kitchen Delhi-NSR (ETA 12m)</p>
              <p><strong className="text-foreground">Amit K.:</strong> Ready for dispatch at Central Depot</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMapModalOpen(false)}
              className="text-xs cursor-pointer"
            >
              Close Map
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default ServicesManagement;
