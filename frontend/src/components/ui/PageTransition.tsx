import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    rotateX: 2,
    y: 10,
    transformPerspective: 1200,
  },
  enter: {
    opacity: 1,
    scale: 1,
    rotateX: 0,
    y: 0,
    transformPerspective: 1200,
  },
  exit: {
    opacity: 0,
    scale: 1.02,
    rotateX: -2,
    y: -10,
    transformPerspective: 1200,
  },
};

const transition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
  mass: 0.8,
};

export const PageTransition: React.FC<PageTransitionProps> = ({ children, className }) => {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={variants}
      transition={transition}
      className={className}
      style={{
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </motion.div>
  );
};
