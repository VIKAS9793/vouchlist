import { useEffect, useRef, useState, type ReactNode } from "react";

type DeferredVisualProps = {
  children: ReactNode;
  /**
   * Wrapper classes. Always reserve the visual's final size here so deferring
   * the contents cannot shift the layout.
   */
  className?: string;
  /** How early to start rendering, relative to the viewport. */
  rootMargin?: string;
  /** Optional lightweight placeholder shown before the visual mounts. */
  placeholder?: ReactNode;
};

/**
 * Renders a below-the-fold visual only once it is about to enter the viewport.
 *
 * Above-the-fold artwork (the hero and its conversation demo) stays eager so it
 * can paint on the first frame. Everything further down the page, especially the
 * looping and path-drawing SVGs, mounts on approach instead: no animation frames
 * are burned for visuals nobody has scrolled to yet.
 */
export function DeferredVisual({
  children,
  className,
  rootMargin = "300px 0px",
  placeholder = null,
}: DeferredVisualProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Without IntersectionObserver (or during SSR hydration on old browsers)
    // fall back to rendering immediately rather than hiding content.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Render when the visual approaches the viewport, and also when a jump
        // scroll has already carried it above the fold.
        const reached = entries.some(
          (entry) => entry.isIntersecting || entry.boundingClientRect.bottom < 0,
        );
        if (reached) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : placeholder}
    </div>
  );
}
