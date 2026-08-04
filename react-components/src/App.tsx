import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { Placeholder } from '@/screens/Placeholder';
import { Journal } from '@/screens/Journal';
import { Miracles } from '@/screens/Miracles';
import { Glossary } from '@/screens/Glossary';
import { Spanish } from '@/screens/Spanish';
import { Objections } from '@/screens/Objections';
import { Email } from '@/screens/Email';
import { Mastery } from '@/screens/Mastery';
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

export default function App() {
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
