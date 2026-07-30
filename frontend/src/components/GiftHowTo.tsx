'use client';
import { useCallback, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

export interface HowToStep {
  n: number;
  t: string;
}

interface GiftHowToProps {
  steps: HowToStep[];
  /** Brand accent for the step badges. */
  accent: string;
}

const src = (n: number) => `/images/truemoney-sendgift-icon-20240521-how-to-create-${n}.png`;

/**
 * The five TrueMoney gift screenshots. The source assets are 400x600, so the
 * grid stays a readable overview and the real reading happens in the viewer,
 * where the image is shown at up to its natural size instead of the ~60px
 * sliver a five-column grid leaves on a phone.
 */
export default function GiftHowTo({ steps, accent }: GiftHowToProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const isOpen = openIdx !== null;

  const close = useCallback(() => setOpenIdx(null), []);
  const step  = useCallback((delta: number) => {
    setOpenIdx(i => (i === null ? i : (i + delta + steps.length) % steps.length));
  }, [steps.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft')  step(-1);
    };
    window.addEventListener('keydown', onKey);
    // Keep the page behind the viewer still while it is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, close, step]);

  const current = openIdx !== null ? steps[openIdx] : null;

  return (
    <>
      {/* Overview grid - two columns on a phone so each screenshot keeps a
          usable width, five only once there is room for it. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
        {steps.map((s, i) => (
          <button key={s.n} type="button" onClick={() => setOpenIdx(i)}
            aria-label={`ดูขั้นตอนที่ ${s.n} แบบเต็มจอ`}
            className="group flex flex-col gap-2 text-left focus:outline-none">
            <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border-2 border-border-muted bg-white transition-all group-hover:border-primary group-hover:shadow-md group-focus-visible:border-primary">
              <img src={src(s.n)} alt={`ขั้นตอนที่ ${s.n}: ${s.t}`}
                className="w-full h-full object-contain" loading="lazy" />
              <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full text-white text-[11px] font-black flex items-center justify-center shadow-sm"
                style={{ backgroundColor: accent }}>{s.n}</span>
              <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            </div>
            <p className="text-[11px] font-bold text-foreground-subtle leading-snug">{s.t}</p>
          </button>
        ))}
      </div>

      <p className="text-[10px] font-bold text-foreground-subtle text-center mt-3">
        แตะที่รูปเพื่อดูภาพใหญ่แบบเต็มจอ
      </p>

      {/* Full-screen viewer */}
      {current && (
        <div role="dialog" aria-modal="true" aria-label={`ขั้นตอนที่ ${current.n}`}
          onClick={close}
          className="fixed inset-0 z-[9998] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overlay-in">

          <div onClick={e => e.stopPropagation()}
            className="relative w-full max-w-[420px] max-h-full flex flex-col items-center gap-3">

            <div className="w-full flex items-center justify-between gap-2">
              <span className="px-3 py-1.5 rounded-full bg-white/15 text-white text-[11px] font-black">
                ขั้นตอนที่ {current.n} จาก {steps.length}
              </span>
              <button type="button" onClick={close} aria-label="ปิด"
                className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative w-full rounded-2xl overflow-hidden bg-white shadow-2xl">
              <img src={src(current.n)} alt={`ขั้นตอนที่ ${current.n}: ${current.t}`}
                className="w-full h-auto max-h-[62vh] object-contain mx-auto" />

              {steps.length > 1 && (
                <>
                  <button type="button" onClick={() => step(-1)} aria-label="ขั้นตอนก่อนหน้า"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => step(1)} aria-label="ขั้นตอนถัดไป"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center transition-colors">
                    <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>

            <p className="text-center text-white text-[13px] font-bold leading-snug px-2">{current.t}</p>

            {/* Thumbnail strip: the whole sequence stays visible, so a player can
                jump straight to the step they are stuck on. */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {steps.map((s, i) => (
                <button key={s.n} type="button" onClick={() => setOpenIdx(i)}
                  aria-label={`ไปที่ขั้นตอนที่ ${s.n}`} aria-current={i === openIdx}
                  className={`w-10 h-14 rounded-lg overflow-hidden border-2 bg-white transition-all ${
                    i === openIdx ? 'border-white scale-105' : 'border-white/25 opacity-60 hover:opacity-100'
                  }`}>
                  <img src={src(s.n)} alt="" className="w-full h-full object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
