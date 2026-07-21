'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { SkeletonStat } from '@/components/SkeletonLoader';
import { Icon, type IconName } from '@/components/ui/icon';

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
  { value: 'all', label: 'ทั้งหมด', icon: 'list' },
  { value: 'open', label: 'รอดำเนินการ', icon: 'clock' },
  { value: 'answered', label: 'ตอบแล้ว', icon: 'check' },
  { value: 'closed', label: 'ปิดแล้ว', icon: 'circle-xmark' },
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

  const fmtDateTime = (d: string) => new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  const statusLabel = (s: Ticket['status']) =>
    s === 'open' ? 'รอดำเนินการ' : s === 'answered' ? 'ตอบแล้ว' : 'ปิดแล้ว';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-h1">แจ้งปัญหา</h2>
          <p className="admin-sub">ตั๋วแจ้งปัญหาและคำขอความช่วยเหลือจากลูกค้า</p>
        </div>
        <button onClick={loadTickets} className="admin-btn" disabled={loading}>
          <Icon name="arrows-rotate" className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="admin-card admin-card-body">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5" role="group" aria-label="กรองตามสถานะ">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              aria-pressed={filter === tab.value}
              className={`admin-btn admin-btn-sm ${filter === tab.value ? 'admin-btn-primary' : ''}`}
            >
              <Icon name={tab.icon as IconName} className="text-[13px]" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two panes on a desktop. On a phone the list is replaced by the
          conversation once a ticket is opened, rather than being squeezed
          alongside it, so neither pane ends up too narrow to read. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <section className={`admin-card lg:col-span-1 ${selectedTicket ? 'hidden lg:block' : ''}`}>
          <div className="admin-card-head">
            <h3 className="admin-section-title">รายการตั๋ว</h3>
            <span className="admin-chip">{filteredTickets.length}</span>
          </div>
          {loading ? (
            <div className="admin-card-body space-y-2">
              <SkeletonStat /> <SkeletonStat />
            </div>
          ) : filteredTickets.length === 0 ? (
            <p className="admin-meta text-center py-8">ไม่มีตั๋วในสถานะนี้</p>
          ) : (
            <ul className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {filteredTickets.map(t => (
                <li key={t.id}>
                  <button
                    onClick={() => handleSelectTicket(t)}
                    aria-current={selectedTicket?.id === t.id ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3 cursor-pointer border-l-2 ${
                      selectedTicket?.id === t.id ? 'border-primary bg-primary/8' : 'border-transparent hover:bg-secondary'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-medium text-foreground truncate">{t.subject}</span>
                      <span className="admin-chip shrink-0">{statusLabel(t.status)}</span>
                    </span>
                    <span className="block admin-meta truncate mt-0.5">{t.user_email}</span>
                    <span className="block admin-meta">{fmtDateTime(t.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card lg:col-span-2">
          {!selectedTicket ? (
            <p className="admin-meta text-center py-12">เลือกตั๋วจากรายการเพื่อดูรายละเอียด</p>
          ) : (
            <>
              <div className="admin-card-head">
                <div className="min-w-0 flex items-start gap-2">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="admin-btn admin-btn-sm lg:hidden shrink-0"
                    aria-label="กลับไปรายการตั๋ว"
                  >
                    <Icon name="arrow-left" className="text-[13px]" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="admin-section-title truncate">{selectedTicket.subject}</h3>
                    <p className="admin-meta truncate">{selectedTicket.user_email}</p>
                  </div>
                </div>
                {selectedTicket.status !== 'closed' && (
                  <button onClick={handleClose} className="admin-btn admin-btn-sm admin-btn-danger">
                    ปิดตั๋ว
                  </button>
                )}
              </div>

              <div className="admin-card-body space-y-3 max-h-[50vh] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="admin-meta text-center py-6">ยังไม่มีข้อความ</p>
                ) : messages.map(m => (
                  <div
                    key={m.id}
                    className={`border rounded-md p-3 ${
                      m.is_admin ? 'border-primary/30 bg-primary/5 md:ml-8' : 'border-border md:mr-8'
                    }`}
                  >
                    <p className="admin-meta mb-1">
                      {m.is_admin ? 'ทีมงาน' : 'ลูกค้า'} ({fmtDateTime(m.created_at)})
                    </p>
                    <p className="text-[14px] text-foreground whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                ))}
              </div>

              {selectedTicket.status !== 'closed' && (
                <form onSubmit={handleReply} className="p-4 border-t border-border space-y-2.5">
                  <label htmlFor="ticket-reply" className="admin-label">ตอบกลับ</label>
                  <textarea
                    id="ticket-reply"
                    className="admin-textarea"
                    rows={3}
                    placeholder="พิมพ์ข้อความตอบกลับลูกค้า"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                  <button type="submit" disabled={sending || !newMessage.trim()} className="admin-btn admin-btn-primary w-full sm:w-auto">
                    {sending && <Icon name="spinner" className="animate-spin" />}
                    ส่งข้อความ
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
