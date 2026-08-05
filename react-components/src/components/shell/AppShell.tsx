import { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SettingsModal } from './SettingsModal';
import { ScriptureLockOverlay } from './ScriptureLockOverlay';
import { WeeklyReflectionModal, shouldShowWeeklyReflection } from './WeeklyReflectionModal';
import { FastReminderModal } from './FastReminderModal';
import { UpdateBanner } from './UpdateBanner';
import { DemoModeBanner } from './DemoModeBanner';
import { isDemoMode } from '@/lib/demo';
import { shouldShowFastReminder, getFastingIntention, isoDate } from '@/lib/health-data';

export function AppShell() {
  const { sectionId = 'spiritual', tabId = 'journal' } = useParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showReflection, setShowReflection] = useState(() => shouldShowWeeklyReflection());
  const [showFastReminder, setShowFastReminder] = useState(() => shouldShowFastReminder());

  // Per-section color scheme — applied to <html> (same element theme.ts
  // toggles `.dark` on) so `.dark.section-spiritual` etc. in index.css can
  // combine correctly regardless of where in the tree this runs. Home
  // (a separate top-level route, see HomeScreen.tsx) never mounts AppShell,
  // so it never gets one of these classes and always shows the untouched
  // base palette.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('section-spiritual', 'section-exercise', 'section-health');
    if (sectionId === 'spiritual') root.classList.add('section-spiritual');
    else if (sectionId === 'exercise') root.classList.add('section-exercise');
    else if (sectionId === 'health') root.classList.add('section-health');
    return () => {
      root.classList.remove('section-spiritual', 'section-exercise', 'section-health');
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
      {showFastReminder ? (
        <FastReminderModal intention={getFastingIntention(isoDate())} onClose={() => setShowFastReminder(false)} />
      ) : (
        showReflection && <WeeklyReflectionModal onClose={() => setShowReflection(false)} />
      )}
    </div>
  );
}
