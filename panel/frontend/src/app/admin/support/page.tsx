'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonStat } from '@/components/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';

interface Ticket {
  id: number;
  user_id: number;
  user_email: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  updated_at: string;
}

interface Message {
  id: number;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const STATUS_TABS = [
  { value: 'all', label: 'ทั้งหมด', icon: 'fa-list' },
  { value: 'open', label: 'รอดำเนินการ', icon: 'fa-clock' },
  { value: 'answered', label: 'ตอบแล้ว', icon: 'fa-check' },
  { value: 'closed', label: 'ปิดแล้ว', icon: 'fa-circle-xmark' },
];

export default function AdminSupportPage() {
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/tickets/admin/all');
      setTickets(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadTickets();
    }
  }, [user, loadTickets]);

  const loadMessages = async (ticketId: number) => {
    try {
      const { data } = await api.get(`/api/tickets/admin/${ticketId}/messages`);
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTicket = (t: Ticket) => {
    setSelectedTicket(t);
    loadMessages(t.id);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket || sending) return;
    setSending(true);
    try {
      await api.post(`/api/tickets/admin/${selectedTicket.id}/messages`, { message: newMessage });
      setNewMessage('');
      await loadMessages(selectedTicket.id);
      loadTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!selectedTicket) return;
    if (!confirm('ยืนยันการปิดตั๋วนี้?')) return;
    try {
      await api.post(`/api/tickets/admin/${selectedTicket.id}/close`);
      setSelectedTicket({ ...selectedTicket, status: 'closed' });
      loadTickets();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredTickets = useMemo(() => {
    if (filter === 'all') return tickets;
    return tickets.filter(t => t.status === filter);
  }, [tickets, filter]);

  if (authLoading) return null;

  return (
    <div className="space-y-6 pb-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-4 mb-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-secondary/50 hover:bg-secondary transition-all" asChild>
              <Link href="/admin">
                <i className="fas fa-arrow-left text-xs" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Support <span className="text-primary text-xl opacity-20">/</span>
            </h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm flex items-center gap-2">
            <i className="fas fa-headset text-primary text-xs" />
            ระบบจัดการตั๋วแจ้งปัญหาและช่วยเหลือลูกค้า (Customer Support)
          </p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
           <Button size="default" onClick={loadTickets} className="rounded-xl font-bold gap-2 h-11 px-6 shadow-md shadow-primary/10 active:scale-95 transition-all">
             <i className={`fas fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} /> รีเฟรชตั๋ว
           </Button>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="rounded-3xl border-border shadow-sm bg-white dark:bg-card overflow-hidden">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5 p-1 bg-secondary/50 rounded-xl items-center">
              {STATUS_TABS.map(tab => (
                <button 
                  key={tab.value} 
                  onClick={() => setFilter(tab.value)}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                    filter === tab.value
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 z-10'
                      : 'text-muted-foreground hover:bg-white hover:text-foreground hover:shadow-sm'
                  }`}
                >
                  <i className={`fas ${tab.icon} ${filter === tab.value ? 'opacity-100' : 'opacity-40'}`} />
                  {tab.label}
                  {tab.value !== 'all' && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${filter === tab.value ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background/50 text-muted-foreground'}`}>
                      {tickets.filter(t => t.status === tab.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Ticket List Sidebar */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ delay: 0.2 }}
          className="xl:col-span-4 h-full"
        >
          <Card className="rounded-3xl border-border shadow-sm flex flex-col h-[700px] overflow-hidden bg-white dark:bg-card">
            <CardHeader className="px-6 py-6 border-b border-border/60 bg-secondary/10 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                   <i className="fas fa-inbox text-sm" />
                 </div>
                 <CardTitle className="text-base font-bold tracking-tight uppercase">Ticket List</CardTitle>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-slate-50/50">
              {loading && tickets.length === 0 ? (
                <div className="p-3 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-20 bg-white border border-border/60 animate-pulse rounded-xl shadow-sm" />
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground/30 text-2xl">
                    <i className="fas fa-folder-open" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No tickets found</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredTickets.map((t, idx) => (
                    <motion.div 
                      key={t.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => handleSelectTicket(t)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group relative active:scale-95 ${selectedTicket?.id === t.id
                        ? 'bg-primary border-primary text-primary-foreground shadow-xl shadow-primary/20 scale-[1.02] z-10'
                        : 'bg-white border-transparent hover:border-primary/20 hover:shadow-lg shadow-sm'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <p className={`text-xs font-bold truncate pr-4 tracking-tight ${selectedTicket?.id === t.id ? 'text-white' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                          #{t.id} {t.subject}
                        </p>
                        <Badge className={`px-1.5 py-0.5 text-[8px] uppercase font-bold tracking-wider border-none rounded-md shrink-0 shadow-sm ${
                          selectedTicket?.id === t.id 
                            ? 'bg-white/20 text-white' 
                            : t.status === 'open' ? 'bg-rose-500 text-white' : t.status === 'answered' ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'
                        }`}>
                          {t.status}
                        </Badge>
                      </div>
                      <p className={`text-[10px] font-medium truncate ${selectedTicket?.id === t.id ? 'text-white/70' : 'text-muted-foreground/60'}`}>
                         {t.user_email}
                      </p>
                      <div className={`mt-2 flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest ${selectedTicket?.id === t.id ? 'text-white/40' : 'text-muted-foreground/30'}`}>
                        <i className="fas fa-clock text-[7px]" />
                        {new Date(t.updated_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Chat / Content Area */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ delay: 0.3 }}
          className="xl:col-span-8 h-full"
        >
          {!selectedTicket ? (
            <Card className="rounded-3xl border-border border-dashed border-2 shadow-sm h-[700px] flex items-center justify-center bg-secondary/5">
              <div className="text-center p-8 space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-white border border-border shadow-xl flex items-center justify-center mx-auto text-primary animate-bounce-slow">
                  <i className="fas fa-comments text-3xl" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground tracking-tight">Select a ticket to begin</h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto font-bold uppercase tracking-widest mt-1 opacity-50">Choose a support request from the list on the left to view details and reply.</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-3xl border-border shadow-sm flex flex-col h-[700px] overflow-hidden bg-white dark:bg-card">
              <CardHeader className="px-6 py-6 border-b border-border/60 bg-secondary/10 flex flex-row items-center justify-between space-y-0 relative z-10">
                <div className="min-w-0">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-border shadow-sm flex items-center justify-center text-primary flex-shrink-0">
                      <i className="fas fa-ticket-alt text-base" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-primary uppercase tracking-widest">Ticket ID: #{selectedTicket.id}</span>
                        <Badge variant="outline" className="text-[8px] font-bold border-primary/20 text-primary bg-primary/5 px-1.5 py-0 rounded-md">{selectedTicket.status}</Badge>
                      </div>
                      <CardTitle className="text-lg font-bold truncate tracking-tight mt-0.5 leading-tight">{selectedTicket.subject}</CardTitle>
                      <CardDescription className="font-bold text-[9px] mt-0.5 truncate uppercase tracking-widest text-muted-foreground opacity-60">{selectedTicket.user_email}</CardDescription>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedTicket.status !== 'closed' && (
                    <Button variant="outline" onClick={handleClose} className="rounded-xl h-10 px-4 font-bold text-[10px] uppercase tracking-wider text-rose-500 border-rose-500/20 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all active:scale-95 cursor-pointer shadow-sm">
                      Close Ticket
                    </Button>
                  )}
                  <button onClick={() => setSelectedTicket(null)} className="xl:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm active:scale-90">
                    <i className="fas fa-times text-sm" />
                  </button>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {messages.map((m, i) => (
                    <motion.div 
                      key={m.id} 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] space-y-1.5`}>
                        <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-md ${m.is_admin
                          ? 'bg-primary text-primary-foreground rounded-tr-none shadow-primary/10'
                          : 'bg-white border border-border/60 text-foreground rounded-tl-none shadow-slate-200/50'}`}>
                          <p className="whitespace-pre-wrap tracking-tight">{m.message}</p>
                        </div>
                        <div className={`flex items-center gap-2 px-1.5 ${m.is_admin ? 'flex-row-reverse' : 'flex-row'}`}>
                           <p className={`text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40`}>
                             {m.is_admin ? 'Authorized Admin' : 'Customer'}
                           </p>
                           <span className="w-1 h-1 rounded-full bg-border/40" />
                           <p className={`text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40`}>
                             {new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                           </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {selectedTicket.status !== 'closed' ? (
                <div className="p-4 border-t border-border/60 bg-white relative z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                  <form onSubmit={handleReply} className="flex gap-3">
                    <div className="flex-1 relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                      <textarea
                        placeholder="Type your reply here..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                        className="relative w-full bg-secondary/30 border-2 border-transparent rounded-xl px-4 py-3 text-xs font-bold outline-none focus:bg-white focus:border-primary/20 transition-all resize-none max-h-32 text-foreground placeholder:text-muted-foreground/40"
                        rows={1}
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={!newMessage.trim() || sending} 
                      className="h-[46px] w-[46px] rounded-xl shrink-0 cursor-pointer shadow-lg shadow-primary/20 active:scale-90 transition-all"
                    >
                      {sending ? <i className="fas fa-spinner fa-spin text-sm" /> : <i className="fas fa-paper-plane text-sm" />}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="p-6 border-t border-border/60 bg-secondary/10 text-center">
                   <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2">
                     <i className="fas fa-lock opacity-30" />
                     Ticket has been closed and archived
                   </p>
                </div>
              )}
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
