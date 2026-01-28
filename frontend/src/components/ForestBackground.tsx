import React from 'react';
import { motion } from 'framer-motion';

export const ForestBackground: React.FC = () => {
  const [particles] = React.useState(() => 
    [...Array(20)].map((_, i) => ({
      id: i,
      initial: {
        x: Math.random() * 100 + "vw",
        y: Math.random() * 100 + "vh",
      },
      animate: {
        x: [
          Math.random() * 100 + "vw",
          Math.random() * 100 + "vw",
          Math.random() * 100 + "vw",
        ],
        y: [
          Math.random() * 100 + "vh",
          Math.random() * 100 + "vh",
          Math.random() * 100 + "vh",
        ],
      },
      duration: Math.random() * 20 + 20,
    })));

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-linear-to-b from-forest-midnight to-forest-moss">
      {/* Animated Fireflies / Particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 bg-accent-mint rounded-full blur-[2px] opacity-20"
          initial={p.initial}
          animate={{
            ...p.animate,
            opacity: [0.1, 0.4, 0.1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
      
      {/* Mystical Fog Overlays */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-10 mix-blend-overlay"></div>
    </div>
  );
};
