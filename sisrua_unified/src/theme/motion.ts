import { Variants } from "framer-motion";

/**
 * motion.ts — Standardized Framer Motion variants for consistency (UX-13).
 * Re-exports useReducedMotion from framer-motion so components only need
 * a single import. When the user has prefers-reduced-motion enabled,
 * components should switch to instantFade or skip continuous animations.
 */
export { useReducedMotion } from "framer-motion";

/** Zero-duration fade for prefers-reduced-motion contexts. */
export const instantFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 20, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: { duration: 0.15 },
  },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
};
