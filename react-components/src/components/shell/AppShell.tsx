import { Outlet, useParams } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const { sectionId = 'spiritual', tabId = 'journal' } = useParams();

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <TopBar activeSectionId={sectionId} onOpenSettings={() => { /* wired in Phase 6: Settings */ }} />
      <main className="mx-auto max-w-[680px] px-4 pt-4" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>
      <BottomNav activeSectionId={sectionId} activeTabId={tabId} />
    </div>
  );
}
