"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string };

type ProductImageCarouselProps = {
  images: string[];
  alt: string;
  videoUrl?: string | null;
  className?: string;
};

export function ProductImageCarousel({ images, alt, videoUrl, className }: ProductImageCarouselProps) {
  const slides = React.useMemo<Slide[]>(() => {
    const gallery: Slide[] = [];
    if (videoUrl) gallery.push({ kind: "video", url: videoUrl });
    for (const url of images.length > 0 ? images : ["/products/placeholder-pants.svg"]) {
      gallery.push({ kind: "image", url });
    }
    return gallery;
  }, [images, videoUrl]);

  const [index, setIndex] = React.useState(0);
  const current = slides[Math.min(index, slides.length - 1)];

  React.useEffect(() => {
    setIndex(0);
  }, [slides.map((slide) => `${slide.kind}:${slide.url}`).join("|")]);

  function prev() {
    setIndex((i) => (i - 1 + slides.length) % slides.length);
  }

  function next() {
    setIndex((i) => (i + 1) % slides.length);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="group relative overflow-hidden rounded-[32px] border border-border bg-paper shadow-soft">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.kind}-${current.url}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {current.kind === "video" ? (
              <video
                src={current.url}
                className="aspect-[4/5] w-full object-cover"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={current.url} alt={alt} className="aspect-[4/5] w-full object-cover" />
            )}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-paper/90 p-2 text-ink shadow-sm opacity-0 transition group-hover:opacity-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-paper/90 p-2 text-ink shadow-sm opacity-0 transition group-hover:opacity-100"
              aria-label="Próximo"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "size-2 rounded-full transition",
                    i === index ? "bg-ivory" : "bg-ivory/45 hover:bg-ivory/70",
                  )}
                  aria-label={slide.kind === "video" ? "Ver vídeo" : `Ver foto ${i + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((slide, i) => (
            <button
              key={`${slide.kind}-${slide.url}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "relative shrink-0 overflow-hidden rounded-xl border-2 transition",
                i === index ? "border-terracotta" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {slide.kind === "video" ? (
                <div className="flex size-16 items-center justify-center bg-ink text-ivory sm:size-20">
                  <Play className="size-5" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={slide.url} alt="" className="size-16 object-cover sm:size-20" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
