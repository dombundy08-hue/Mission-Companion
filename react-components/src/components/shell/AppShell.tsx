import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SettingsModal } from './SettingsModal';
import { ScriptureLockOverlay } from './ScriptureLockOverlay';
import { WeeklyReflectionModal, shouldShowWeeklyReflection } from './WeeklyReflectionModal';
import { UpdateBanner } from './UpdateBanner';
import { DemoModeBanner } from './DemoModeBanner';
import { isDemoMode } from '@/lib/demo';

export function AppShell() {
  const { sectionId = 'spiritual', tabId = 'journal' } = useParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showReflection, setShowReflection] = useState(() => shouldShowWeeklyReflection());

  // Per-section color scheme — applied to <html> (same element theme.ts
  // toggles `.dark` on) so `.dark.section-exercise` etc. in index.css can
  // combine correctly regardless of where in the tree this runs.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('section-exercise', 'section-health');
    if (sectionId === 'exercise') root.classList.add('section-exercise');
    else if (sectionId === 'health') root.classList.add('section-health');
    return () => {
      root.classList.remove('section-exercise', 'section-health');
    };
  }, [sectionId]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {isDemoMode() && <DemoModeBanner />}
      <UpdateBanner />
      <TopBar activeSectionId={sectionId} onOpenSettings={() => setSettingsOpen(true)} />
      <main className="mx-auto max-w-[680px] px-4 pt-4" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        <Outlet />
      </main>
      <BottomNav activeSectionId={sectionId} activeTabId={tabId} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ScriptureLockOverlay />
      {showReflection && <WeeklyReflectionModal onClose={() => setShowReflection(false)} />}
    </div>
  );
}
