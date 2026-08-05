import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECTIONS, SECTION_ACCENT_COLORS, findSection } from '@/lib/sections';
import { getLS } from '@/lib/storage';
import { effectiveStreak } from '@/lib/mastery';
import { todaysProgramSlot, type WorkoutLogEntry } from '@/lib/exercise-data';
import { todaysFoodTotals, waterTotal } from '@/lib/health-data';
import { isDarkModeOn } from '@/lib/theme';
import { isDemoMode } from '@/lib/demo';
import { DemoModeBanner } from '@/components/shell/DemoModeBanner';
import { UpdateBanner } from '@/components/shell/UpdateBanner';
import { SettingsModal } from '@/components/shell/SettingsModal';

// Top-level page (no BottomNav, own header) — the app's default landing
// screen, always shown in the base/untouched palette regardless of which
// section was last visited (AppShell never mounts here, so no `.section-*`
// class is ever applied). A light snapshot per section, reusing data/
// helpers that already exist elsewhere — no new tracking logic.
function startOfWeekTs(): number {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

interface Stat {
  label: string;
  value: string | number;
}

function Tile({
  onClick,
  accent,
  iconImage,
  title,
  stats,
}: {
  onClick: () => void;
  accent: string;
  iconImage: string;
  title: string;
  stats: Stat[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[16px] border p-4 text-left"
      style={{ borderColor: 'var(--border)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="flex h-14 w-14 flex-none items-center justify-center rounded-full"
        style={{ background: `${accent}22` }}
      >
        <img src={iconImage} alt="" className="h-9 w-9 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 text-[17px] font-bold" style={{ color: 'var(--foreground)' }}>{title}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {stats.map((s) => (
            <div key={s.label} className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <span className="font-bold" style={{ color: 'var(--foreground)' }}>{s.value}</span> {s.label}
            </div>
          ))}
        </div>
      </div>
      <span className="flex-none text-lg" style={{ color: accent }}>›</span>
    </button>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const weekStart = startOfWeekTs();
  const journalCount = getLS<{ timestamp: number }[]>('journalEntries', []).filter((e) => e.timestamp >= weekStart).length;
  const miracleCount = getLS<{ timestamp: number }[]>('miracleEntries', []).filter((e) => e.timestamp >= weekStart).length;
  const streak = effectiveStreak();

  const workoutCount = getLS<WorkoutLogEntry[]>('workoutLog', []).filter((e) => e.timestamp >= weekStart).length;
  const programSlot = todaysProgramSlot();

  const food = todaysFoodTotals();
  const water = waterTotal();

  const dark = isDarkModeOn();
  const accentFor = (id: string) => SECTION_ACCENT_COLORS[id]?.[dark ? 'dark' : 'light'] ?? 'var(--primary)';

  function enterSection(id: string) {
    const section = findSection(id);
    if (section) navigate(`/${id}/${section.tabs[0].id}`);
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {isDemoMode() && <DemoModeBanner />}
      <UpdateBanner />

      <header
        className="sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 text-white"
        style={{ background: 'var(--navy)', boxShadow: '0 1px 6px rgba(0,0,0,.12)' }}
      >
        <div />
        <span className="justify-self-center whitespace-nowrap text-sm font-bold tracking-wide" style={{ color: 'var(--gold)' }}>
          Missionary Companion
        </span>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[22px] active:bg-white/10"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[680px] px-4 pt-4 pb-8">
        <h1 className="mb-4 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>Welcome back</h1>

        <div className="space-y-3">
          <Tile
            onClick={() => enterSection('spiritual')}
            accent={accentFor('spiritual')}
            iconImage={SECTIONS[0].iconImage}
            title="Spiritual"
            stats={[
              { label: 'journal entries this week', value: journalCount },
              { label: 'miracles this week', value: miracleCount },
              { label: `scripture streak`, value: `🔥${streak}` },
            ]}
          />
          <Tile
            onClick={() => enterSection('exercise')}
            accent={accentFor('exercise')}
            iconImage={SECTIONS[1].iconImage}
            title="Exercise"
            stats={[
              { label: 'workouts this week', value: workoutCount },
              ...(programSlot?.routine ? [{ label: "today's workout", value: programSlot.routine.name }] : []),
            ]}
          />
          <Tile
            onClick={() => enterSection('health')}
            accent={accentFor('health')}
            iconImage={SECTIONS[2].iconImage}
            title="Health"
            stats={[
              { label: 'calories today', value: Math.round(food.calories) },
              { label: 'protein today', value: `${Math.round(food.protein)}g` },
              { label: 'water today', value: `${Math.round(water)}oz` },
            ]}
          />
        </div>
      </main>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
