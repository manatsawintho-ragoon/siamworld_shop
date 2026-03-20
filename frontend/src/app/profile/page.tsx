'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useAuth } from '@/context/AuthContext';
import { api, getToken } from '@/lib/api';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api('/wallet/transactions', { token: getToken()! })
      .then(d => setTransactions((d.transactions as Transaction[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-brand-400 mb-4"></i>
          <p className="text-gray-400 dark:text-gray-500">กำลังโหลด...</p>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
            <i className="fas fa-lock text-2xl text-gray-300 dark:text-gray-600"></i>
          </div>
          <h2 className="text-xl font-bold mb-2 dark:text-white">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-gray-500 dark:text-gray-400">คุณต้องเข้าสู่ระบบก่อนจึงจะดูโปรไฟล์ได้</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          <i className="fas fa-user mr-2 text-brand-500"></i>โปรไฟล์
        </h1>

        {/* Profile Card */}
        <div className="card p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/5 dark:bg-brand-500/10 rounded-full -translate-y-12 translate-x-12"></div>
          <div className="flex items-center gap-4 relative">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-2xl flex items-center justify-center shadow-theme-md">
              <i className="fas fa-user text-2xl text-white"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold dark:text-white">{user.username}</h2>
              <span className={`badge ${
                user.role === 'admin'
                  ? 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {user.role === 'admin' ? 'Admin' : 'Player'}
              </span>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">ยอดเงินคงเหลือ</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">{user.wallet_balance?.toLocaleString()} ฿</p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold dark:text-white">
              <i className="fas fa-clock-rotate-left mr-2 text-brand-400"></i>ประวัติธุรกรรม
            </h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
              <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
              <p>กำลังโหลด...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
                <i className="fas fa-inbox text-xl text-gray-300 dark:text-gray-500"></i>
              </div>
              <p className="text-gray-400 dark:text-gray-500">ยังไม่มีธุรกรรม</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ประเภท</th>
                    <th>จำนวน</th>
                    <th>รายละเอียด</th>
                    <th>วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`badge ${
                          tx.type === 'topup' ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400' :
                          tx.type === 'purchase' ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400' :
                          tx.type === 'refund' ? 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {tx.type === 'topup' ? 'เติมเงิน' :
                           tx.type === 'purchase' ? 'ซื้อสินค้า' :
                           tx.type === 'refund' ? 'คืนเงิน' : tx.type}
                        </span>
                      </td>
                      <td className={`font-bold ${tx.amount > 0 ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ฿
                      </td>
                      <td className="text-gray-500 dark:text-gray-400">{tx.description}</td>
                      <td className="text-gray-400 dark:text-gray-500 text-xs">
                        {new Date(tx.created_at).toLocaleString('th-TH')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
