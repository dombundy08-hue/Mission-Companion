import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SECTIONS, findSection } from '@/lib/sections';
import { cn } from '@/lib/utils';
import { isWorkoutActive } from '@/lib/workout-session';

interface TopBarProps {
  activeSectionId: string;
  onOpenSettings: () => void;
}

export function TopBar({ activeSectionId, onOpenSettings }: TopBarProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navigate = useNavigate();
  const section = findSection(activeSectionId);

  return (
    <>
      <header
        className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 text-white"
        style={{
          background: 'var(--navy)',
          backgroundImage: 'linear-gradient(var(--navy), var(--navy))',
          backdropFilter: 'blur(14px) saturate(160%)',
          WebkitBackdropFilter: 'blur(14px) saturate(160%)',
          boxShadow: '0 1px 6px rgba(0,0,0,.12)',
        }}
      >
        <motion.button
          type="button"
          onClick={() => { if (!isWorkoutActive()) setSwitcherOpen(true); }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.25, ease: 'backInOut' }}
          className="flex items-center gap-2 text-base font-semibold"
        >
          {section?.iconImage && <img src={section.iconImage} alt="" className="h-9 w-9 object-contain" />}
          <span>{section?.name}</span>
          <span className="text-xs opacity-70">▾</span>
        </motion.button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-[10px] text-[22px] active:bg-white/10"
        >
          ⚙️
        </button>
      </header>

      {switcherOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50"
          onClick={() => setSwitcherOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            style={{ background: 'var(--card)', color: 'var(--foreground)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 font-heading text-xl font-semibold">Sections</h2>
            <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Jump to another part of your life.
            </p>
            <div className="space-y-2">
              {SECTIONS.map((s) => (
                <motion.button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    navigate(`/${s.id}/${s.tabs[0].id}`);
                    setSwitcherOpen(false);
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.25, ease: 'backInOut' }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                    s.id === activeSectionId ? 'border-transparent' : 'border-border'
                  )}
                  style={
                    s.id === activeSectionId
                      ? { background: 'var(--navy-soft)', color: '#fff' }
                      : undefined
                  }
                >
                  <img src={s.iconImage} alt="" className="h-12 w-12 object-contain" />
                  <span className="font-medium">{s.name}</span>
                </motion.button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSwitcherOpen(false)}
              className="mt-4 w-full rounded-xl py-3 text-sm font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
