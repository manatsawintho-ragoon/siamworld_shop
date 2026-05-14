'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

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
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-amber-500 shadow-2xl overflow-hidden animate-saas-fade">
        <div className="p-6 border-b-2 border-gray-100 dark:border-slate-800 flex items-center gap-4">
          <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-search'} text-amber-500 text-lg`} />
          <input 
            autoFocus
            type="text" 
            placeholder="Search for users or store clusters... (Press ESC to close)"
            className="w-full bg-transparent border-none outline-none text-lg font-bold text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-slate-700"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto p-4 custom-scrollbar">
          {!query && (
            <div className="py-10 text-center">
              <p className="text-saas-label">Quick Navigation</p>
              <div className="flex justify-center gap-4 mt-4">
                {['Customers', 'Payments', 'Settings'].map(t => (
                  <button key={t} onClick={() => { router.push(`/admin/${t.toLowerCase()}`); setIsOpen(false); }} className="px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-amber-500 transition-all border-2 border-transparent hover:border-amber-200">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query && results.length === 0 && !loading && (
            <div className="py-10 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">No matching results found</div>
          )}

          <div className="space-y-2">
            {results.map((r, i) => (
              <button 
                key={i} 
                onClick={() => navigate(r.type, r.id, r.detail)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all group border-2 border-transparent hover:border-amber-100 dark:hover:border-amber-900/50"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm border-2 ${r.type === 'user' ? 'bg-blue-50 border-blue-100 text-blue-500' : 'bg-amber-50 border-amber-100 text-amber-500'}`}>
                  <i className={`fas ${r.type === 'user' ? 'fa-user' : 'fa-server'}`} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-black text-gray-900 dark:text-white uppercase tracking-tight truncate">{r.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{r.detail}</p>
                </div>
                <div className="text-[10px] font-black text-gray-300 group-hover:text-amber-400 uppercase tracking-widest">Enter ↵</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-3 flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
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
