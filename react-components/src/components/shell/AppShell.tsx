import { useEffect, useState } from 'react';
import { Outlet, useParams, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { SettingsModal } from './SettingsModal';
import { WeeklyReflectionModal, shouldShowWeeklyReflection } from './WeeklyReflectionModal';
import { FastReminderModal } from './FastReminderModal';
import { UpdateBanner } from './UpdateBanner';
import { DemoModeBanner } from './DemoModeBanner';
import { SaveToast } from './SaveToast';
import { SyncPlaceholder } from './SyncPlaceholder';
import { isDemoMode } from '@/lib/demo';
import { shouldShowFastReminder, getFastingIntention, isoDate } from '@/lib/health-data';
import { pullSectionOnce, isSectionPulled } from '@/lib/cloud-pull';

export function AppShell() {
  const { sectionId = 'spiritual', tabId = 'journal' } = useParams();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showFastReminder, setShowFastReminder] = useState(false);
  const [sectionReady, setSectionReady] = useState(() => isSectionPulled(sectionId));

  // Pull this section's data on first visit only — see lib/cloud-pull.ts's
  // pullSectionOnce(). Gates just the section content (not TopBar/BottomNav)
  // so a screen never mounts before its own data has actually landed in
  // localStorage — mounting early would show empty/stale data with no
  // automatic re-render once the pull finishes.
  useEffect(() => {
    if (isSectionPulled(sectionId)) {
      setSectionReady(true);
      return;
    }
    let cancelled = false;
    setSectionReady(false);
    pullSectionOnce(sectionId).finally(() => {
      if (!cancelled) setSectionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  // Re-evaluate on every tab navigation (AppShell itself doesn't remount when
  // moving between tabs within a section) and whenever the tab regains focus
  // — catches a day/week rolling over while the app was left open, not just
  // the moment a section is first entered.
  useEffect(() => {
    function recheck() {
      setShowFastReminder(shouldShowFastReminder());
      setShowReflection(shouldShowWeeklyReflection());
    }
    recheck();
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, [location.pathname]);

  // Per-section color scheme — applied to <html> (same element theme.ts
  // toggles `.dark` on) so `.dark.section-spiritual` etc. in index.css can
  // combine correctly regardless of where in the tree this runs. `/contacts`
  // (a separate top-level route) never mounts AppShell, so it never gets one
  // of these classes and always shows the untouched base palette.
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
      <div className="sticky top-0 z-40">
        {isDemoMode() && <DemoModeBanner />}
        <UpdateBanner />
        <TopBar activeSectionId={sectionId} onOpenSettings={() => setSettingsOpen(true)} />
      </div>
      <main className="mx-auto max-w-[680px] px-4 pt-4" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        {sectionReady ? <Outlet /> : <SyncPlaceholder />}
      </main>
      <BottomNav activeSectionId={sectionId} activeTabId={tabId} />
      <SaveToast />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {showFastReminder ? (
        <FastReminderModal intention={getFastingIntention(isoDate())} onClose={() => setShowFastReminder(false)} />
      ) : (
        showReflection && <WeeklyReflectionModal onClose={() => setShowReflection(false)} />
      )}
    </div>
  );
}
