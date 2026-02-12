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
      try {
        // Ensure we don't add the plugin if it's already there or if uppy is destroyed
        const existingPlugin = uppy.getPlugin('Dashboard');
        if (!existingPlugin) {
             uppy.use(DashboardPlugin, {
                target: containerRef.current,
                inline: true,
                width: '100%',
                height: 450,
                ...props
            });
        }
      } catch (err) {
        console.warn('UppyDashboard initialization warning:', err);
      }
    }

    return () => {
      try {
        const plugin = uppy.getPlugin('Dashboard');
        if (plugin) {
          uppy.removePlugin(plugin);
        }
      } catch (err) {
        console.warn('UppyDashboard cleanup warning:', err);
      }
    };
  }, [uppy, props]);

  return <div ref={containerRef} className={className} />;
};

export default UppyDashboard;
