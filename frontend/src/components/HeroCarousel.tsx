'use client';
import { useEffect, useState } from 'react';

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
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-brand-950 to-gray-900 py-20 px-4">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #465FFF 0%, transparent 60%)' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-500/20 text-brand-300 text-xs font-semibold px-3 py-1 rounded-full mb-4 border border-brand-500/30">
            <i className="fas fa-sparkles"></i> Minecraft Item Shop
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">SiamWorld Shop</h1>
          <p className="text-gray-300 text-lg mb-8 max-w-md mx-auto">ร้านค้าไอเทม Minecraft ออนไลน์ ส่งของอัตโนมัติ</p>
          <a href="/shop" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-8 py-3 rounded-xl font-semibold shadow-theme-md hover:shadow-theme-lg transition-all duration-300">
            <i className="fas fa-store"></i> เข้าร้านค้า
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[250px] sm:h-[380px]">
        {slides.map((slide, i) => (
          <div key={slide.id} className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <img src={slide.image_url} alt={slide.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {slide.title && (
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="max-w-7xl mx-auto">
                  <h2 className="text-xl md:text-3xl font-bold text-white drop-shadow-lg">{slide.title}</h2>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-brand-400' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
