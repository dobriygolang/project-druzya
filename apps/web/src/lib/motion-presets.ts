import { useReducedMotion, type MotionProps } from 'framer-motion'

export function useMotion(_preset: 'pageTransition'): MotionProps {
  const reduced = useReducedMotion()
  if (reduced) return {}
  return {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -2 },
    transition: { duration: 0.24, ease: [0.2, 0.7, 0.2, 1] },
  }
}
