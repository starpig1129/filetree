import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className,
  size = 40
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <motion.span
          className="absolute inset-0 block rounded-full border-t-2 border-transparent"
          style={{
            borderTopColor: 'var(--color-quantum-cyan, #22d3ee)',
            boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)'
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-2 block rounded-full border-t-2 border-transparent opacity-80"
          style={{
            borderTopColor: 'var(--color-neural-violet, #a855f7)',
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]"
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </div>
      <motion.p
        className="text-xs font-bold tracking-[0.3em] text-cyan-500/80 dark:text-quantum-cyan/80 uppercase"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Loading
      </motion.p>
    </div>
  );
};
