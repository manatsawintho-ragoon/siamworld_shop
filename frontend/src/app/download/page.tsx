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
      <section className="card overflow-hidden">
        <div className="card-header-mc flex items-center gap-3">
          <i className="fas fa-download text-primary"></i>
          <div>
            <span className="font-black text-gray-900">Download ดาวน์โหลดเกมส์</span>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 skeleton rounded-lg"></div>
              ))}
            </div>
          ) : downloads.length === 0 ? (
            <div className="text-center py-16">
              <i className="fas fa-download text-5xl text-foreground-subtle mb-4"></i>
              <p className="text-foreground-muted font-bold">ยังไม่มีไฟล์ดาวน์โหลด</p>
              <p className="text-foreground-subtle text-sm mt-1">คอยติดตามการอัปเดตจากทีมงาน</p>
            </div>
          ) : (
            <div className="space-y-3">
              {downloads.map(dl => (
                <div
                  key={dl.id}
                  className="flex items-center gap-4 bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-primary/30 transition-all group"
                >
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                    <i className="fas fa-file-archive text-xl text-primary"></i>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 font-bold text-sm truncate">{dl.filename}</h3>
                    {dl.description && (
                      <p className="text-foreground-muted text-xs mt-0.5 line-clamp-2">{dl.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {dl.file_size && (
                        <div className="flex items-center gap-1">
                          <i className="fas fa-weight-hanging text-[10px] text-foreground-subtle"></i>
                          <span className="text-foreground-subtle text-[11px]">{dl.file_size}</span>
                        </div>
                      )}
                      {dl.category && (
                        <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">{dl.category}</span>
                      )}
                    </div>
                  </div>

                  {/* Download Button */}
                  <a
                    href={dl.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-xs py-2.5 px-4 flex-shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                  >
                    <i className="fas fa-download mr-1.5"></i>
                    ดาวน์โหลด
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
