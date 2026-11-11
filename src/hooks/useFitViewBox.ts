import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface UseFitViewBoxOptions {
  svgRef: RefObject<SVGSVGElement>;
  contentRef: RefObject<SVGGElement>;
  width: number;
  height: number;
  enabled: boolean;
  /** Padding (viewBox units) kept around the measured content. */
  padding?: number;
  /** Smallest fraction of the full width the fitted box may shrink to. */
  minWidthRatio?: number;
}

// Re-measure shortly after DOM changes, and again once typical entry
// animations (scale/opacity, ~0.4–0.5s) have settled.
const REMEASURE_DELAYS_MS = [50, 700];

/**
 * Crops an SVG stage's viewBox to the area its content actually occupies.
 *
 * Frames are drawn on a fixed 800×500 canvas, but most only use its middle.
 * On a phone that canvas is squeezed into ~360px, so labels end up at 5–7px.
 * Fitting the viewBox to the content's bounding box zooms the diagram in.
 *
 * The fitted box only ever grows while a frame is mounted, so the camera
 * never jitters back and forth as animation phases add or move elements.
 */
export const useFitViewBox = ({
  svgRef,
  contentRef,
  width,
  height,
  enabled,
  padding = 16,
  minWidthRatio = 0.5,
}: UseFitViewBoxOptions): { viewBox: ViewBox; measured: number } => {
  const full: ViewBox = { x: 0, y: 0, w: width, h: height };
  const [viewBox, setViewBox] = useState<ViewBox>(full);
  // Counts measurements so callers can skip animating the first fit.
  const [measured, setMeasured] = useState(0);
  const unionRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const measure = useCallback((): void => {
    const svg = svgRef.current;
    const content = contentRef.current;
    if (!svg || !content) return;
    const ctm = svg.getScreenCTM();
    const rect = content.getBoundingClientRect();
    if (!ctm || rect.width === 0 || rect.height === 0) return;

    // Map the content's screen rect back into viewBox coordinates.
    const inv = ctm.inverse();
    const a = new DOMPoint(rect.left, rect.top).matrixTransform(inv);
    const b = new DOMPoint(rect.right, rect.bottom).matrixTransform(inv);
    const box = {
      x1: Math.max(0, Math.min(a.x, b.x)),
      y1: Math.max(0, Math.min(a.y, b.y)),
      x2: Math.min(width, Math.max(a.x, b.x)),
      y2: Math.min(height, Math.max(a.y, b.y)),
    };
    if (box.x2 <= box.x1 || box.y2 <= box.y1) return;

    const prev = unionRef.current;
    const u = prev
      ? {
          x1: Math.min(prev.x1, box.x1),
          y1: Math.min(prev.y1, box.y1),
          x2: Math.max(prev.x2, box.x2),
          y2: Math.max(prev.y2, box.y2),
        }
      : box;
    unionRef.current = u;

    // Pad, enforce a minimum width (avoid over-zooming sparse early phases),
    // then shift the box back inside the canvas.
    const minW = width * minWidthRatio;
    let w = Math.min(width, Math.max(u.x2 - u.x1 + padding * 2, minW));
    let h = Math.min(height, u.y2 - u.y1 + padding * 2);
    let x = (u.x1 + u.x2) / 2 - w / 2;
    let y = (u.y1 + u.y2) / 2 - h / 2;
    x = Math.max(0, Math.min(x, width - w));
    y = Math.max(0, Math.min(y, height - h));
    w = Math.round(w);
    h = Math.round(h);
    x = Math.round(x);
    y = Math.round(y);

    setViewBox((cur) =>
      cur.x === x && cur.y === y && cur.w === w && cur.h === h ? cur : { x, y, w, h },
    );
    setMeasured((n) => n + 1);
  }, [svgRef, contentRef, width, height, padding, minWidthRatio]);

  // Initial fit before paint, so the first frame isn't shown un-zoomed.
  useLayoutEffect(() => {
    unionRef.current = null;
    if (!enabled) {
      setViewBox({ x: 0, y: 0, w: width, h: height });
      setMeasured(0);
      return;
    }
    measure();
  }, [enabled, width, height, measure]);

  useEffect(() => {
    const content = contentRef.current;
    if (!enabled || !content) return;

    let timers: number[] = [];
    const schedule = (): void => {
      timers.forEach((t) => window.clearTimeout(t));
      timers = REMEASURE_DELAYS_MS.map((d) => window.setTimeout(measure, d));
    };

    // Animation phases mount/unmount elements; re-fit when that happens.
    const observer = new MutationObserver(schedule);
    observer.observe(content, { childList: true, subtree: true });
    schedule();

    return () => {
      observer.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [enabled, contentRef, measure]);

  return { viewBox, measured };
};
