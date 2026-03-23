'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';

interface Download {
  id: number;
  filename: string;
  description: string;
  file_size: string;
  download_url: string;
  category: string;
  active: number;
  sort_order: number;
}

export default function DownloadPage() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/public/downloads')
      .then(d => setDownloads((d.downloads as Download[]) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <i className="fas fa-download text-green-600 text-lg" />
            ดาวน์โหลด
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">ดาวน์โหลดไฟล์และแพ็คเกจสำหรับเกม</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_4px_0_#d1d5db,0_2px_20px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          <div className="p-4 min-h-[200px]">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : downloads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <i className="fas fa-download text-2xl text-gray-300" />
                </div>
                <p className="text-gray-600 font-bold text-sm">ยังไม่มีไฟล์ดาวน์โหลด</p>
                <p className="text-gray-400 text-xs mt-1">คอยติดตามการอัปเดตจากทีมงาน</p>
              </div>
            ) : (
              <div className="space-y-2">
                {downloads.map(dl => (
                  <div key={dl.id}
                    className="flex items-center gap-4 bg-gray-50 hover:bg-gray-100 rounded-xl p-4 border border-gray-200 transition-all group">
                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-file-archive text-lg text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-900 font-bold text-sm truncate">{dl.filename}</h3>
                      {dl.description && (
                        <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{dl.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {dl.file_size && (
                          <span className="text-gray-400 text-[10px]">
                            <i className="fas fa-weight-hanging mr-1" />{dl.file_size}
                          </span>
                        )}
                        {dl.category && (
                          <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider bg-green-50 px-2 py-0.5 rounded-full">
                            {dl.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <a href={dl.download_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-xl shadow-[0_3px_0_#14532d] hover:shadow-[0_1px_0_#14532d] hover:translate-y-[1px] active:shadow-none active:translate-y-[3px] transition-all flex-shrink-0">
                      <i className="fas fa-download text-[10px]" /> ดาวน์โหลด
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
