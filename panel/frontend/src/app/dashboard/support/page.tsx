'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

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

  const handleSelectTicket = (t: Ticket) => {
    setSelectedTicket(t);
    setCreating(false);
    loadMessages(t.id);
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
            แจ้งปัญหา <span className="text-amber-500">Support</span>
          </h1>
          <button 
            onClick={() => { setCreating(true); setSelectedTicket(null); setNewMessage(''); setSubject(''); }}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500"
          >
            เปิดตั๋วใหม่
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h2 className="text-lg font-bold text-white mb-4">ตั๋วของคุณ</h2>
              {tickets.length === 0 && <p className="text-slate-400 text-sm">ไม่มีตั๋ว</p>}
              <div className="space-y-2">
                {tickets.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => handleSelectTicket(t)}
                    className={`p-3 rounded-lg cursor-pointer border ${selectedTicket?.id === t.id ? 'border-emerald-500 bg-slate-700' : 'border-slate-700 bg-slate-800 hover:bg-slate-700'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-white truncate mr-2" title={t.subject}>{t.subject}</span>
                      <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${t.status === 'open' ? 'bg-amber-500/20 text-amber-500' : t.status === 'answered' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-400'}`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">อัพเดต: {new Date(t.updated_at).toLocaleString('th-TH')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket Detail / Create Form */}
          <div className="lg:col-span-2">
            {creating ? (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">เปิดตั๋วแจ้งปัญหาใหม่</h2>
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">หัวข้อ</label>
                    <input 
                      type="text" 
                      required
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">รายละเอียดปัญหา</label>
                    <textarea 
                      required
                      rows={5}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-slate-300 hover:text-white">ยกเลิก</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500">ส่งข้อความ</button>
                  </div>
                </form>
              </div>
            ) : selectedTicket ? (
              <div className="bg-slate-800 border border-slate-700 rounded-xl flex flex-col h-[600px]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
                    <span className="text-sm text-slate-400">สถานะ: {selectedTicket.status}</span>
                  </div>
                  {selectedTicket.status !== 'closed' && (
                    <button onClick={handleClose} className="px-3 py-1 text-sm bg-red-500/20 text-red-500 border border-red-500/50 rounded hover:bg-red-500 hover:text-white transition-colors">
                      ปิดตั๋วนี้
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.is_admin ? 'items-start' : 'items-end'}`}>
                      <div className={`max-w-[80%] rounded-xl p-3 ${m.is_admin ? 'bg-slate-700 text-white' : 'bg-emerald-600 text-white'}`}>
                        <div className="text-xs opacity-70 mb-1">{m.is_admin ? 'Admin' : 'คุณ'} • {new Date(m.created_at).toLocaleString('th-TH')}</div>
                        <div className="whitespace-pre-wrap text-sm">{m.message}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedTicket.status !== 'closed' ? (
                  <form onSubmit={handleReply} className="p-4 border-t border-slate-700 flex gap-2">
                    <input 
                      type="text" 
                      required
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="พิมพ์ข้อความ..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500">ส่ง</button>
                  </form>
                ) : (
                  <div className="p-4 border-t border-slate-700 text-center text-slate-500 text-sm">
                    ตั๋วนี้ถูกปิดแล้ว ไม่สามารถตอบกลับได้
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-xl h-[600px] flex items-center justify-center text-slate-500">
                เลือกตั๋วจากรายการด้านซ้าย หรือเปิดตั๋วใหม่
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}