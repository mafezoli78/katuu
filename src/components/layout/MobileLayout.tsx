import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { AppHeader } from './AppHeader';

interface MobileLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
  fixedHeight?: boolean;
  headerVersion?: string;
}

export function MobileLayout({ children, showNav = true, showHeader = true, fixedHeight = false, headerVersion }: MobileLayoutProps) {
  return (
    <div className={`mobile-container bg-background flex flex-col ${fixedHeight ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {showHeader && <AppHeader version={headerVersion} />}
      <main
        className={`flex-1 overflow-y-auto ${fixedHeight ? 'overflow-hidden' : ''}`}
        style={showNav ? { paddingBottom: 'calc(64px + var(--safe-area-inset-bottom))' } : undefined}
      >
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
