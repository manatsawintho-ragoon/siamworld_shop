'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Icon, type IconName } from '@/components/ui/icon';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: 'user' | 'shop'; id: any; name: string; detail: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/admin/search', { params: { q: query } });
        setResults(data.results);
      } catch { } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const navigate = (type: 'user' | 'shop', id: any, detail: string) => {
    setIsOpen(false);
    setQuery('');
    if (type === 'user') router.push(`/admin/users?search=${detail}`);
    else router.push(`/admin/customers?search=${detail}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-slate-950/55" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Icon name={loading ? 'spinner' : 'search'} className={`text-amber-500 text-lg ${loading ? 'animate-spin' : ''}`} />
          <input 
            autoFocus
            type="text" 
            placeholder="ค้นหาผู้ใช้หรือร้านค้า (กด ESC เพื่อปิด)"
            className="w-full bg-transparent border-none outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
          {!query && (
            <div className="py-10 text-center">
              <p className="text-[13px] text-muted-foreground">ไปที่หน้า</p>
              <div className="flex justify-center gap-4 mt-4">
                {[{ label: 'ร้านค้า', path: 'customers' }, { label: 'การชำระเงิน', path: 'payments' }, { label: 'ตั้งค่า', path: 'settings' }].map(t => (
                  <button key={t.path} onClick={() => { router.push(`/admin/${t.path}`); setIsOpen(false); }} className="admin-btn admin-btn-sm">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="py-10 text-center text-[13px] text-muted-foreground">ไม่พบผลลัพธ์ที่ตรงกัน</div>
          )}

          <div className="space-y-2">
            {results.map((r, i) => (
              <button 
                key={i} 
                onClick={() => navigate(r.type, r.id, r.detail)}
                className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-secondary group border border-transparent hover:border-border cursor-pointer"
              >
                <div className={`w-9 h-9 rounded-md flex items-center justify-center text-sm border ${r.type === 'user' ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400' : 'bg-primary/10 border-primary/25 text-primary'}`}>
                  <Icon name={r.type === 'user' ? 'user' : 'server'} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-foreground truncate">{r.name}</p>
                  <p className="text-[12px] text-muted-foreground truncate">{r.detail}</p>
                </div>
                <div className="text-[12px] text-muted-foreground group-hover:text-primary shrink-0">Enter</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-3 flex items-center justify-between text-[12px] font-semibold text-gray-400">
          <span>Search Engine v1.0</span>
          <div className="flex gap-4">
            <span><span className="bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600 shadow-sm mr-1">↑↓</span> Select</span>
            <span><span className="bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-gray-200 dark:border-slate-600 shadow-sm mr-1">ESC</span> Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
