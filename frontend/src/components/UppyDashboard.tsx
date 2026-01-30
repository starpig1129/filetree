import React, { useEffect, useRef } from 'react';
import Uppy from '@uppy/core';
import DashboardPlugin from '@uppy/dashboard';

interface UppyDashboardProps {
  uppy: Uppy;
  className?: string;
  props?: Record<string, unknown>;
}

export const UppyDashboard: React.FC<UppyDashboardProps> = ({ uppy, className, props }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      uppy.use(DashboardPlugin, {
        target: containerRef.current,
        inline: true,
        width: '100%',
        height: 450,
        ...props
      });
    }

    return () => {
      const plugin = uppy.getPlugin('Dashboard');
      if (plugin) {
        uppy.removePlugin(plugin);
      }
    };
  }, [uppy, props]);

  return <div ref={containerRef} className={className} />;
};

export default UppyDashboard;
