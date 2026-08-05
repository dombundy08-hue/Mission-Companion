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
  iconImage: string; // custom-designed icon, replaces `icon` in the UI — see MASTER.md
  tabs: TabDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'spiritual',
    name: 'Spiritual',
    icon: '✝️',
    iconImage: '/icons/section-spiritual.png',
    tabs: [
      { id: 'journal', label: 'Journal', icon: '📓' },
      { id: 'miracles', label: 'Miracles', icon: '✨' },
      { id: 'objections', label: 'Objections', icon: '🙋' },
      { id: 'spanish', label: 'Spanish', icon: '🗣️' },
      { id: 'mastery', label: 'Mastery', icon: '📖' },
      { id: 'email', label: 'Email', icon: '✉️' },
    ],
  },
  {
    id: 'exercise',
    name: 'Exercise',
    icon: '💪',
    iconImage: '/icons/section-exercise.png',
    tabs: [
      { id: 'workout', label: 'Workout', icon: '▶️' },
      { id: 'routines', label: 'Routines', icon: '📋' },
      { id: 'wlog', label: 'Log', icon: '📈' },
    ],
  },
  {
    id: 'health',
    name: 'Health',
    icon: '🍎',
    iconImage: '/icons/section-health.png',
    tabs: [
      { id: 'health', label: 'Today', icon: '🍎' },
      { id: 'hfood', label: 'Food', icon: '🍽️' },
      { id: 'hbody', label: 'Body', icon: '⚖️' },
      { id: 'hstats', label: 'Stats', icon: '📊' },
    ],
  },
];

// Home isn't wrapped in any `.section-*` CSS class (it always shows the
// base palette), so its tile swatches need plain JS colors that mirror
// each section's `--primary`/`--accent` from index.css. Keep hand-synced
// if those hexes ever get tuned.
export const SECTION_ACCENT_COLORS: Record<string, { light: string; dark: string }> = {
  spiritual: { light: '#7A3FC4', dark: '#A96FE0' },
  exercise: { light: '#D9622B', dark: '#E27A45' },
  health: { light: '#1E8F6F', dark: '#4FC79E' },
};

export function findSection(sectionId: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.id === sectionId);
}

export function findTab(sectionId: string, tabId: string): TabDef | undefined {
  return findSection(sectionId)?.tabs.find((t) => t.id === tabId);
}
