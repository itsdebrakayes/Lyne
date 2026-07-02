/**
 * PageTransition — Wraps page content with smooth framer-motion entrance animation
 * Uses a subtle fade + upward slide for professional feel
 */
import { motion, type Variants } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.23, 0.86, 0.39, 0.96],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
