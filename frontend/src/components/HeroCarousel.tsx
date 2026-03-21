'use client';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Slide {
  id: number;
  title: string;
  image_url: string;
  link_url?: string;
}

export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const goTo = useCallback((idx: number, dir: number) => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const goPrev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length, -1);
  }, [current, slides.length, goTo]);

  const goNext = useCallback(() => {
    goTo((current + 1) % slides.length, 1);
  }, [current, slides.length, goTo]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => goNext(), 5000);
    return () => clearInterval(timer);
  }, [slides.length, goNext]);

  if (slides.length === 0) return null;

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  const slide = slides[current];

  return (
    <section className="group/carousel relative overflow-hidden w-full h-full">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slide.id}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {slide.link_url ? (
            <a href={slide.link_url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              <img src={slide.image_url} alt={slide.title || ''} className="w-full h-full object-cover" draggable={false} />
            </a>
          ) : (
            <img src={slide.image_url} alt={slide.title || ''} className="w-full h-full object-cover" draggable={false} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom gradient + title */}
      {slide.title && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-5 pb-4 pt-8 pointer-events-none">
          <p className="text-white font-bold text-sm drop-shadow-md">{slide.title}</p>
        </div>
      )}

      {/* Hover Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:shadow-xl"
            aria-label="Previous slide"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-gray-800 shadow-lg flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all duration-300 hover:shadow-xl"
            aria-label="Next slide"
          >
            <i className="fas fa-chevron-right text-sm"></i>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 1 : -1)}
              className={`h-1 rounded-sm transition-all duration-300 ${i === current ? 'w-7 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
