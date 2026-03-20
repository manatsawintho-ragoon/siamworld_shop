'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';

interface LootBox {
  id: number;
  name: string;
  description?: string;
  image?: string;
  price: number;
  sort_order: number;
}

export default function LootBoxListPage() {
  const [boxes, setBoxes] = useState<LootBox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/shop/lootboxes')
      .then(d => setBoxes((d.boxes as LootBox[]) || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-16 px-4">
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #465FFF 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 bg-warning-500/20 text-warning-300 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-warning-500/30">
            <i className="fas fa-gift"></i> กล่องสุ่มไอเทม
          </div>
          <h1 className="text-4xl font-black mb-3 tracking-tight">LOOT BOXES</h1>
          <p className="text-gray-300 text-base max-w-md mx-auto">
            เข้าเกมก่อน จากนั้นเปิดกล่องเพื่อรับไอเทมสุ่มเข้าเกมทันที
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-800 dark:bg-gray-800 rounded-xl h-60 animate-pulse" />
            ))}
          </div>
        ) : boxes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <i className="fas fa-box-open text-2xl text-gray-300 dark:text-gray-600"></i>
            </div>
            <p className="text-lg font-medium text-gray-500 dark:text-gray-400">ยังไม่มีกล่องสุ่มในขณะนี้</p>
            <p className="text-sm mt-1 text-gray-400 dark:text-gray-500">ติดตามโปรโมชั่นใหม่เร็วๆ นี้!</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-3">
              <div className="w-8 h-8 bg-warning-50 dark:bg-warning-500/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-boxes-stacked text-warning-500 text-sm"></i>
              </div>
              กล่องสุ่มทั้งหมด
              <span className="text-sm font-normal text-gray-400">({boxes.length} กล่อง)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {boxes.map(box => (
                <Link
                  key={box.id}
                  href={`/lootbox/${box.id}`}
                  className="group relative bg-gray-900 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-700 dark:border-gray-700 hover:border-brand-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10 pointer-events-none" />

                  <div className="aspect-square flex items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
                    {box.image ? (
                      <img
                        src={box.image}
                        alt={box.name}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-2xl"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600 group-hover:text-brand-400 transition-colors">
                        <i className="fas fa-box text-5xl"></i>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-warning-500 text-black text-xs font-black px-2 py-0.5 rounded-lg z-20">
                      ฿{parseFloat(String(box.price)).toLocaleString()}
                    </div>
                  </div>

                  <div className="relative z-20 px-3 pb-3">
                    <p className="text-white font-bold text-sm truncate">{box.name}</p>
                    {box.description && (
                      <p className="text-gray-400 text-xs truncate mt-0.5">{box.description}</p>
                    )}
                    <div className="mt-2 bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold py-1.5 rounded-lg text-center transition-colors">
                      <i className="fas fa-box-open mr-1"></i>เปิดกล่อง
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
