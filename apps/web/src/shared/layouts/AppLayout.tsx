import type { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return <div className="min-h-screen bg-bg text-fg">{children}</div>;
}
