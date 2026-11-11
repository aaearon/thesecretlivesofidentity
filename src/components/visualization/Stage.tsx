import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFitViewBox } from '@/hooks/useFitViewBox';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { StageProps } from '@/types';
import { stageDimensions } from '@/utils/constants';

// Below Tailwind's `md` breakpoint the 800-unit-wide canvas is squeezed into a
// phone-width column, so we crop the viewBox to the drawn content instead.
const MOBILE_QUERY = '(max-width: 767px)';

export const Stage: React.FC<StageProps> = ({
  children,
  width = stageDimensions.width,
  height = stageDimensions.height,
  className = '',
  label,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const prefersReducedMotion = useReducedMotion();
  const { viewBox, measured } = useFitViewBox({
    svgRef,
    contentRef,
    width,
    height,
    enabled: isMobile,
  });
  const viewBoxStr = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  // Snap the first fit; ease later re-fits so the "camera" glides out.
  const instant = prefersReducedMotion || measured <= 1;

  return (
    <div
      className={`relative mx-auto w-full max-w-4xl flex items-center justify-center ${className}`}
      // aspectRatio gives the stage an intrinsic height derived from its
      // (capped) width so it never collapses, while maxHeight:100% lets it
      // shrink to fit when a height-constrained parent (the track frame's
      // flex-1 visualization region) is shorter than that intrinsic height.
      // preserveAspectRatio keeps the diagram centered and correctly scaled
      // at every size — it grows to fill on tall screens and shrinks on short
      // laptop viewports instead of overflowing and pushing the title away.
      // On phones the stage is square: portrait screens have spare height,
      // and the cropped viewBox can use it.
      style={{ aspectRatio: isMobile ? '1 / 1' : `${width} / ${height}`, maxHeight: '100%' }}
    >
      <motion.svg
        ref={svgRef}
        viewBox={viewBoxStr}
        initial={false}
        animate={{ viewBox: viewBoxStr }}
        transition={{ duration: instant ? 0 : 0.4, ease: 'easeOut' }}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label={label ?? 'Illustration for this step; the concept is explained in the text above.'}
      >
        {/* Background gradient */}
        <defs>
          <radialGradient id="stageGradient" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1E293B" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.w}
          height={viewBox.h}
          fill="url(#stageGradient)"
        />
        {/* Fixed-size viewport for the frame's drawing. Frames nest their own
            <svg className="w-full h-full">, and percent sizes resolve against
            the nearest viewport — without this wrapper they would resolve
            against the cropped viewBox and shrink along with it. */}
        <svg x={0} y={0} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <g ref={contentRef}>{children}</g>
        </svg>
      </motion.svg>
    </div>
  );
};
