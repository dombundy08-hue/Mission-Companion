import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { KineticLoader } from '@/components/shell/KineticLoader';
import { AppIntro } from '@/components/shell/AppIntro';
import { AuthProvider, useAuth } from '@/components/shell/AuthContext';
import { LockScreen } from '@/components/shell/LockScreen';
import { ContactShare } from '@/screens/ContactShare';
import { ContactsCollection } from '@/screens/ContactsCollection';
import { Placeholder } from '@/screens/Placeholder';
import { Journal } from '@/screens/Journal';
import { Miracles } from '@/screens/Miracles';
import { Spanish } from '@/screens/Spanish';
import { Objections } from '@/screens/Objections';
import { Email } from '@/screens/Email';
import { Mastery } from '@/screens/Mastery';
import { HealthToday } from '@/screens/HealthToday';
import { HealthFood } from '@/screens/HealthFood';
import { HealthBody } from '@/screens/HealthBody';
import { HealthStats } from '@/screens/HealthStats';
import { HealthSetup } from '@/screens/HealthSetup';
import { Routines } from '@/screens/Routines';
import { Workout } from '@/screens/Workout';
import { WorkoutLog } from '@/screens/WorkoutLog';
import { findTab } from '@/lib/sections';
import { pullAndMergeAll } from '@/lib/cloud-pull';

function TabRoute({ sectionId, tabId }: { sectionId: string; tabId: string }) {
  switch (`${sectionId}/${tabId}`) {
    case 'spiritual/journal':
      return <Journal />;
    case 'spiritual/miracles':
      return <Miracles />;
    case 'spiritual/spanish':
      return <Spanish />;
    case 'spiritual/objections':
      return <Objections />;
    case 'spiritual/email':
      return <Email />;
    case 'spiritual/mastery':
      return <Mastery />;
    case 'health/health':
      return <HealthToday />;
    case 'health/hfood':
      return <HealthFood />;
    case 'health/hbody':
      return <HealthBody />;
    case 'health/hstats':
      return <HealthStats />;
    case 'health/hsetup':
      return <HealthSetup />;
    case 'exercise/routines':
      return <Routines />;
    case 'exercise/workout':
      return <Workout />;
    case 'exercise/wlog':
      return <WorkoutLog />;
    default: {
      const tab = findTab(sectionId, tabId);
      return <Placeholder label={tab?.label ?? tabId} icon={tab?.icon ?? '•'} />;
    }
  }
}

function TabPage() {
  const { sectionId = 'spiritual', tabId = 'journal' } = useParams();
  return <TabRoute sectionId={sectionId} tabId={tabId} />;
}

// Pulls existing cloud data down into localStorage once per authenticated
// session — this was documented as the intended design but never actually
// built, so a device with empty/cleared local storage would show nothing
// even though real data was safely sitting in Supabase the whole time.
// KineticLoader (real "something is loading" indicator) covers this wait.
function useCloudSynced(authenticated: boolean) {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    pullAndMergeAll().finally(() => {
      if (!cancelled) setSynced(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  return synced;
}

function GatedApp() {
  const [introDone, setIntroDone] = useState(false);
  const { authenticated } = useAuth();
  const synced = useCloudSynced(authenticated);

  // AppIntro's own duration (several seconds) already comfortably covers
  // font loading — no separate "ready" gate needed before it, which used
  // to show its own KineticLoader and made the boot sequence feel like the
  // brand animation was playing multiple times in a row. Now there's at
  // most two distinct screens: the intro once, and KineticLoader once
  // (only if actually syncing) after the password is entered.
  if (!introDone) return <AppIntro onDone={() => setIntroDone(true)} />;
  if (!authenticated) return <LockScreen />;
  if (!synced) return <KineticLoader />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/spiritual/journal" replace />} />
      <Route path="/contacts" element={<ContactsCollection />} />
      <Route element={<AppShell />}>
        <Route path="/:sectionId/:tabId" element={<TabPage />} />
      </Route>
    </Routes>
  );
}

// The QR contact-share page is public — reached by a stranger scanning a
// missionary's QR code — so it must live outside AuthProvider/LockScreen
// entirely, not just skip the password check while still gated.
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/contact/:code" element={<ContactShare />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <GatedApp />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
