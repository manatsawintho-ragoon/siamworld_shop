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
      <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-green-900 py-10 px-4 rounded-2xl mb-8 border border-green-600">
        <div className="absolute inset-0 opacity-15"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgb(var(--color-primary)) 0%, transparent 70%)' }} />
        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 bg-warning/20 text-yellow-300 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 border border-warning/30">
            <i className="fas fa-gift" aria-hidden="true"></i> กล่องสุ่มไอเท็ม
          </div>
          <h1 className="text-4xl font-black mb-3 tracking-tight">LOOT BOXES</h1>
          <p className="text-gray-400 text-base max-w-md mx-auto">
            เข้าเกมก่อน จากนั้นเปิดกล่องเพื่อรับไอเท็มสุ่มเข้าเกมทันที
          </p>
        </div>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl h-60 skeleton" />
            ))}
          </div>
        ) : boxes.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-hover rounded-2xl flex items-center justify-center">
              <i className="fas fa-box-open text-2xl text-foreground-subtle" aria-hidden="true"></i>
            </div>
            <p className="text-lg font-medium text-foreground-muted">ยังไม่มีกล่องสุ่มในขณะนี้</p>
            <p className="text-sm mt-1 text-foreground-subtle">ติดตามโปรโมชั่นใหม่เร็วๆ นี้!</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-3">
              <div className="w-9 h-9 bg-warning/10 rounded-xl flex items-center justify-center">
                <i className="fas fa-boxes-stacked text-warning text-sm" aria-hidden="true"></i>
              </div>
              กล่องสุ่มทั้งหมด
              <span className="text-sm font-normal text-foreground-muted tabular-nums">({boxes.length} กล่อง)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {boxes.map(box => (
                <Link
                  key={box.id}
                  href={`/lootbox/${box.id}`}
                  className="group relative bg-white rounded-2xl overflow-hidden border border-gray-200 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 z-10 pointer-events-none" />

                  <div className="aspect-square flex items-center justify-center p-6 relative overflow-hidden bg-gray-50">
                    {box.image ? (
                      <img
                        src={box.image}
                        alt={box.name}
                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-2xl"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-600 group-hover:text-primary transition-colors">
                        <i className="fas fa-box text-5xl" aria-hidden="true"></i>
                      </div>
                    )}
                    <div className="absolute top-2.5 right-2.5 bg-warning text-black text-xs font-black px-2.5 py-1 rounded-lg z-20 tabular-nums">
                      ฿{parseFloat(String(box.price)).toLocaleString()}
                    </div>
                  </div>

                  <div className="relative z-20 px-3 pb-3">
                    <p className="text-gray-900 font-bold text-sm truncate">{box.name}</p>
                    {box.description && (
                      <p className="text-gray-500 text-xs truncate mt-0.5">{box.description}</p>
                    )}
                    <div className="mt-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold py-2 rounded-xl text-center transition-colors min-h-[36px] flex items-center justify-center">
                      <i className="fas fa-box-open mr-1" aria-hidden="true"></i>เปิดกล่อง
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
