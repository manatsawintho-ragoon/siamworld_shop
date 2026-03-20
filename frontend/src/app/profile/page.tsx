'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description?: string;
  created_at: string;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/'); return; }
    if (!authLoading && user) {
      api('/wallet/transactions', { token: getToken()! })
        .then(d => setTransactions((d.transactions as Transaction[]) || []))
        .finally(() => setTxLoading(false));
    }
  }, [authLoading, user]);

  const txTypeConfig: Record<string, { label: string; color: string; icon: string }> = {
    topup: { label: 'เติมเงิน', color: 'text-success', icon: 'fa-arrow-down' },
    purchase: { label: 'ซื้อของ', color: 'text-error', icon: 'fa-arrow-up' },
    refund: { label: 'คืนเงิน', color: 'text-warning', icon: 'fa-rotate-left' },
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Profile Header */}
        <div className="card overflow-hidden mb-8">
          <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
          <div className="px-6 pb-6 -mt-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border-4 border-surface flex items-center justify-center mb-3 shadow-theme-sm">
              <i className="fas fa-user text-2xl text-primary" aria-hidden="true"></i>
            </div>
            <h1 className="text-2xl font-black text-foreground">{user?.username || '...'}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="badge bg-primary/10 text-primary border border-primary/20">
                <i className="fas fa-user-tag mr-1" aria-hidden="true"></i>
                {user?.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              <span className="text-sm text-foreground-muted">
                ยอดเงิน: <span className="font-bold text-success tabular-nums">฿{user?.wallet_balance?.toLocaleString() || '0'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <a href="/topup" className="card p-4 text-center group hover:shadow-theme-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 mx-auto rounded-xl bg-success/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <i className="fas fa-wallet text-success" aria-hidden="true"></i>
            </div>
            <span className="text-xs font-medium text-foreground">เติมเงิน</span>
          </a>
          <a href="/inventory" className="card p-4 text-center group hover:shadow-theme-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 mx-auto rounded-xl bg-warning/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <i className="fas fa-box text-warning" aria-hidden="true"></i>
            </div>
            <span className="text-xs font-medium text-foreground">คลังของ</span>
          </a>
          <a href="/shop" className="card p-4 text-center group hover:shadow-theme-md transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <i className="fas fa-store text-primary" aria-hidden="true"></i>
            </div>
            <span className="text-xs font-medium text-foreground">ร้านค้า</span>
          </a>
        </div>

        {/* Transaction History */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <i className="fas fa-clock-rotate-left text-primary" aria-hidden="true"></i>
            <h2 className="font-bold text-foreground">ประวัติธุรกรรม</h2>
          </div>

          {txLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 skeleton" />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center">
              <i className="fas fa-receipt text-3xl text-foreground-subtle mb-3 block" aria-hidden="true"></i>
              <p className="text-foreground-muted">ยังไม่มีธุรกรรม</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th>จำนวนเงิน</th>
                    <th className="hidden sm:table-cell">รายละเอียด</th>
                    <th>วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const cfg = txTypeConfig[tx.type] || { label: tx.type, color: 'text-foreground-muted', icon: 'fa-circle' };
                    const isPositive = tx.type === 'topup' || tx.type === 'refund';
                    return (
                      <tr key={tx.id}>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
                            <i className={`fas ${cfg.icon} text-xs`} aria-hidden="true"></i>
                            {cfg.label}
                          </span>
                        </td>
                        <td>
                          <span className={`font-bold text-sm tabular-nums ${isPositive ? 'text-success' : 'text-error'}`}>
                            {isPositive ? '+' : '-'}฿{Math.abs(tx.amount).toLocaleString()}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell text-foreground-muted text-xs max-w-[200px] truncate">
                          {tx.description || '—'}
                        </td>
                        <td className="text-foreground-subtle text-xs tabular-nums whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
