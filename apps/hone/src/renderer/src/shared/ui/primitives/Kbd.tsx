// Single-responsibility primitive; style lives on the `.kbd` class in
// globals.css so the same chip can be sized differently (`.kbd-lg`) from
// the call site without a prop.
import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return <span className="kbd">{children}</span>;
}
