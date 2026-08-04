import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { KineticLoader } from '@/components/shell/KineticLoader';
import { Placeholder } from '@/screens/Placeholder';
import { Journal } from '@/screens/Journal';
import { Miracles } from '@/screens/Miracles';
import { Glossary } from '@/screens/Glossary';
import { Spanish } from '@/screens/Spanish';
import { Objections } from '@/screens/Objections';
import { Email } from '@/screens/Email';
import { Mastery } from '@/screens/Mastery';
import { HealthToday } from '@/screens/HealthToday';
import { HealthFood } from '@/screens/HealthFood';
import { HealthBody } from '@/screens/HealthBody';
import { HealthStats } from '@/screens/HealthStats';
import { HealthSetup } from '@/screens/HealthSetup';
import { findTab } from '@/lib/sections';

function TabRoute({ sectionId, tabId }: { sectionId: string; tabId: string }) {
  switch (`${sectionId}/${tabId}`) {
    case 'spiritual/journal':
      return <Journal />;
    case 'spiritual/miracles':
      return <Miracles />;
    case 'spiritual/glossary':
      return <Glossary />;
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

// Boot splash stays up until fonts are genuinely ready AND at least one
// kinetic-loader word cycle has played (so a warm cache doesn't just flash it).
function useBootReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const minDuration = new Promise((resolve) => setTimeout(resolve, 1300));
    Promise.all([document.fonts.ready, minDuration]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}

export default function App() {
  const ready = useBootReady();

  if (!ready) return <KineticLoader />;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/spiritual/journal" replace />} />
        <Route element={<AppShell />}>
          <Route path="/:sectionId/:tabId" element={<TabPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
