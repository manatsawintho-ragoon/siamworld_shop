'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import { Link } from '@/i18n/navigation';

interface Ticket {
  id: number;
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

export default function SupportPage() {
  const t = useTranslations('support');
  const { user, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  const loadTickets = async () => {
    try {
      const { data } = await api.get('/api/tickets');
      setTickets(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMessages = async (ticketId: number) => {
    try {
      const { data } = await api.get(`/api/tickets/${ticketId}/messages`);
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setCreating(false);
    loadMessages(ticket.id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !newMessage) return;
    try {
      await api.post('/api/tickets', { subject, message: newMessage });
      setSubject('');
      setNewMessage('');
      setCreating(false);
      loadTickets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage || !selectedTicket) return;
    try {
      await api.post(`/api/tickets/${selectedTicket.id}/messages`, { message: newMessage });
      setNewMessage('');
      loadMessages(selectedTicket.id);
      loadTickets();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    if (!selectedTicket) return;
    try {
      await api.post(`/api/tickets/${selectedTicket.id}/close`);
      setSelectedTicket({ ...selectedTicket, status: 'closed' });
      loadTickets();
    } catch (e) {
      console.error(e);
    }
  };

  if (authLoading) return null;

  return (
    <div className="page-shell">
      <Navbar />
      <div className="page-content space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading mb-0.5">
            {t('title')} <span className="text-amber-500">Support</span>
          </h1>
          <button 
            onClick={() => { setCreating(true); setSelectedTicket(null); setNewMessage(''); setSubject(''); }}
            className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90"
          >
            {t('newTicket')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">{t('yourTickets')}</h2>
              {tickets.length === 0 && <p className="text-muted-foreground text-sm">{t('noTickets')}</p>}
              <div className="space-y-2">
                {tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => handleSelectTicket(ticket)}
                    className={`p-3 rounded-lg cursor-pointer border ${selectedTicket?.id === ticket.id ? 'border-primary bg-primary/8' : 'border-border bg-background hover:bg-secondary'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground truncate mr-2" title={ticket.subject}>{ticket.subject}</span>
                      <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${ticket.status === 'open' ? 'bg-amber-500/20 text-amber-500' : ticket.status === 'answered' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-secondary text-muted-foreground'}`}>
                        {ticket.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[13px] text-muted-foreground">{t('updatedLabel')} {new Date(ticket.updated_at).toLocaleString('th-TH')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket Detail / Create Form */}
          <div className="lg:col-span-2">
            {creating ? (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">{t('openNewTicket')}</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-secondary-foreground mb-1.5">{t('subject')}</label>
                    <input 
                      type="text" 
                      required
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-secondary-foreground mb-1.5">{t('details')}</label>
                    <textarea 
                      required
                      rows={5}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground">{t('cancel')}</button>
                    <button type="submit" data-track="support_submit" className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90">{t('sendMessage')}</button>
                  </div>
                </form>
              </div>
            ) : selectedTicket ? (
              <div className="bg-card border border-border rounded-xl flex flex-col h-[70vh] min-h-[420px]">
                <div className="p-4 border-b border-border flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">{selectedTicket.subject}</h2>
                    <span className="text-[13px] text-muted-foreground">{t('statusLabel')} {selectedTicket.status}</span>
                  </div>
                  {selectedTicket.status !== 'closed' && (
                    <button onClick={handleClose} className="px-3 py-1 text-sm bg-destructive/10 text-destructive border border-destructive/40 rounded hover:bg-destructive hover:text-white">
                      {t('closeTicket')}
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.is_admin ? 'items-start' : 'items-end'}`}>
                      <div className={`max-w-[80%] rounded-xl p-3 ${m.is_admin ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}>
                        <div className="text-xs opacity-70 mb-1">{m.is_admin ? 'Admin' : t('you')} • {new Date(m.created_at).toLocaleString('th-TH')}</div>
                        <div className="whitespace-pre-wrap text-sm">{m.message}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedTicket.status !== 'closed' ? (
                  <form onSubmit={handleReply} className="p-4 border-t border-border flex gap-2">
                    <input 
                      type="text" 
                      required
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder={t('typeMessage')}
                      className="flex-1 bg-background border border-border rounded-lg px-4 py-2 text-foreground focus:outline-none focus:border-primary"
                    />
                    <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90">{t('send')}</button>
                  </form>
                ) : (
                  <div className="p-4 border-t border-border text-center text-muted-foreground text-[13px]">
                    {t('ticketClosed')}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl h-[70vh] min-h-[420px] flex items-center justify-center text-muted-foreground">
                {t('pickTicket')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}