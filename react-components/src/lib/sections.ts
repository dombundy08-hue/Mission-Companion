// Ported from index.html's `SECTIONS` config (source of truth: the vanilla
// app). Data-driven — the nav/switcher build themselves from this, same
// principle as the vanilla app's own "don't hand-write nav markup" rule.
export interface TabDef {
  id: string;
  label: string;
  icon: string; // emoji — deliberately preserved, see MASTER.md anti-patterns
}

export interface SectionDef {
  id: string;
  name: string;
  icon: string;
  tabs: TabDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'spiritual',
    name: 'Spiritual',
    icon: '✝️',
    tabs: [
      { id: 'journal', label: 'Journal', icon: '📓' },
      { id: 'spanish', label: 'Spanish', icon: '🗣️' },
      { id: 'mastery', label: 'Mastery', icon: '📖' },
      { id: 'email', label: 'Email', icon: '✉️' },
      { id: 'objections', label: 'Objections', icon: '🙋' },
      { id: 'glossary', label: 'Glossary', icon: '📔' },
      { id: 'miracles', label: 'Miracles', icon: '✨' },
    ],
  },
  {
    id: 'exercise',
    name: 'Exercise',
    icon: '💪',
    tabs: [{ id: 'routine', label: 'Routines', icon: '🏋️' }],
  },
  {
    id: 'health',
    name: 'Health',
    icon: '🍎',
    tabs: [
      { id: 'food', label: 'Food', icon: '🍽️' },
      { id: 'stats', label: 'Stats', icon: '📊' },
    ],
  },
];

export function findSection(sectionId: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === sectionId);
}

export function findTab(sectionId: string, tabId: string): TabDef | undefined {
  return findSection(sectionId)?.tabs.find((t) => t.id === tabId);
}
