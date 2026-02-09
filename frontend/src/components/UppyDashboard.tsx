import React, { useEffect, useRef, useState, useCallback } from 'react';
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';

interface UppyDashboardProps {
  uppy: Uppy;
  className?: string;
  props?: Record<string, unknown>;
}

/**
 * Calculate responsive height for Uppy Dashboard based on viewport width.
 * Mobile (<640px): 150px to fit content without scrolling
 * Tablet (640-1024px): 220px
 * Desktop (>=1024px): Uses provided height or defaults to 300px
 */
const getResponsiveHeight = (baseHeight?: number): number => {
  if (typeof window === 'undefined') return baseHeight ?? 300;
  const width = window.innerWidth;
  if (width < 640) return 150;
  if (width < 1024) return 220;
  return baseHeight ?? 300;
};

export const UppyDashboard: React.FC<UppyDashboardProps> = ({ uppy, className, props }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(() =>
    getResponsiveHeight(props?.height as number | undefined)
  );

  // Handle window resize for responsive height
  const handleResize = useCallback(() => {
    const newHeight = getResponsiveHeight(props?.height as number | undefined);
    setHeight(newHeight);
  }, [props?.height]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    // Initial call to set correct height
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (containerRef.current) {
      uppy.use(DashboardPlugin, {
        target: containerRef.current,
        inline: true,
        width: '100%',
        height,
        ...props,
      });
    }

    return () => {
      const plugin = uppy.getPlugin('Dashboard');
      if (plugin) {
        uppy.removePlugin(plugin);
      }
    };
  }, [uppy, props, height]);

  return <div ref={containerRef} className={className} />;
};

export default UppyDashboard;
