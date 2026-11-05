'use client';

/**
 * Entrada de las burbujas del chat (5/11): lo que ya estaba al abrir aparece quieto; lo que
 * llega después entra con un resorte corto desde su lado. Con movimiento reducido, solo fundido.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useMotionReduced } from '@/lib/motion/use-motion-reduced';

const OpenedContext = createContext<{ current: boolean }>({ current: false });

export function ThreadList({ className, children }: { className?: string; children: ReactNode }) {
  const opened = useRef(false);
  useEffect(() => {
    opened.current = true;
  }, []);
  return (
    <OpenedContext.Provider value={opened}>
      <ol className={className}>{children}</ol>
    </OpenedContext.Provider>
  );
}

export function ThreadItem({
  inbound,
  className,
  children,
}: {
  inbound: boolean;
  className?: string;
  children: ReactNode;
}) {
  const opened = useContext(OpenedContext);
  const [isNew] = useState(() => opened.current);
  const reduced = useMotionReduced();
  return (
    <motion.li
      className={className}
      style={{ transformOrigin: inbound ? 'bottom left' : 'bottom right' }}
      initial={isNew ? (reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }) : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 420, damping: 30, mass: 0.7, opacity: { duration: 0.2 } }
      }
    >
      {children}
    </motion.li>
  );
}
