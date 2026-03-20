'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Slide {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
}

export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1e1e1e] via-[#252526] to-[#1e1e1e] py-20 px-4">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgb(var(--color-primary)) 0%, transparent 60%)' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/20 text-primary-foreground/80 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 border border-primary/30">
            <i className="fas fa-sparkles" aria-hidden="true"></i> Minecraft Item Shop
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">SiamWorld Shop</h1>
          <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">ร้านค้าไอเทม Minecraft ออนไลน์ ส่งของอัตโนมัติ</p>
          <a
            href="/shop"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-3.5 rounded-xl font-semibold shadow-theme-md hover:shadow-theme-lg transition-all duration-300 active:scale-95"
          >
            <i className="fas fa-store" aria-hidden="true"></i> เข้าร้านค้า
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[250px] sm:h-[380px]">
        <AnimatePresence initial={false}>
          <motion.div
            key={slides[current].id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <img
              src={slides[current].image_url}
              alt={slides[current].title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {slides[current].title && (
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-xl md:text-3xl font-bold text-white drop-shadow-lg">{slides[current].title}</h2>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-primary' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
