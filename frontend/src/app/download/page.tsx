'use client';
import { useEffect, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';

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
      <div className="max-w-4xl mx-auto pb-20">
        
        {/* ── Compact Header ── */}
        <div className="mb-8 border-b-2 border-border/50 pb-6 flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              DOWNLOADS
            </h1>
            <p className="text-xs font-medium text-foreground-subtle uppercase tracking-wider">
              ทรัพยากรที่จำเป็นสำหรับเซิร์ฟเวอร์
            </p>
          </div>
          <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-[10px] font-bold text-primary">
            {downloads.length} FILES AVAILABLE
          </div>
        </div>

        {/* ── Compact List ── */}
        <div className="space-y-3 min-h-[300px]">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-lg border border-border animate-pulse" />
            ))
          ) : (
            downloads.map((dl, idx) => (
              <motion.div
                key={dl.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-4 bg-surface border-[1.5px] border-border p-3 rounded-xl hover:border-primary/30 transition-colors shadow-sm"
              >
                {/* Minimal Icon Slot */}
                <div className="w-10 h-10 shrink-0 bg-background rounded-lg border border-border flex items-center justify-center text-primary/60">
                  <i className="fas fa-file-alt text-lg"></i>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground truncate uppercase tracking-tight">{dl.filename}</h3>
                    {dl.category && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-border-muted text-foreground-muted border border-border/50 uppercase">
                        {dl.category}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-foreground-muted truncate">
                    {dl.description || 'ดาวน์โหลดไฟล์ทรัพยากรเพื่อเริ่มเล่น'}
                  </p>
                </div>

                {/* Meta & Action */}
                <div className="flex items-center gap-4 shrink-0 px-2">
                  <div className="text-right hidden sm:block">
                    <span className="block text-[9px] font-bold text-foreground-subtle uppercase tracking-widest">Size</span>
                    <span className="block text-[10px] font-black text-foreground">{dl.file_size || 'N/A'}</span>
                  </div>
                  
                  <a 
                    href={dl.download_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn-primary !px-4 !py-1.5 !text-[10px] uppercase tracking-widest"
                  >
                    <i className="fas fa-download mr-1"></i>
                    GET
                  </a>
                </div>
              </motion.div>
            ))
          )}

          {!loading && downloads.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl">
              <p className="text-foreground-muted font-bold text-sm">ไม่พบรายการไฟล์ที่พร้อมให้ดาวน์โหลดในขณะนี้</p>
            </div>
          )}
        </div>

        {/* ── Disclaimer ── */}
        <div className="mt-8 flex items-center gap-2 justify-center text-[10px] font-bold text-foreground-subtle uppercase tracking-widest opacity-60">
          <i className="fas fa-info-circle text-primary"></i>
          <span>Files are scanned for safety before upload</span>
        </div>

      </div>
    </MainLayout>
  );
}
