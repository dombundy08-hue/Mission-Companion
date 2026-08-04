import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { findSection } from '@/lib/sections';

interface BottomNavProps {
  activeSectionId: string;
  activeTabId: string;
}

export function BottomNav({ activeSectionId, activeTabId }: BottomNavProps) {
  const navigate = useNavigate();
  const section = findSection(activeSectionId);
  if (!section) return null;
  const few = section.tabs.length <= 3;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around px-0.5 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5"
      style={{
        background: 'var(--navy)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        boxShadow: '0 -1px 8px rgba(0,0,0,.18)',
      }}
    >
      {section.tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <motion.button
            key={tab.id}
            type="button"
            onClick={() => navigate(`/${section.id}/${tab.id}`)}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.88 }}
            transition={{ duration: 0.3, ease: 'backInOut' }}
            className="flex min-h-[52px] flex-1 flex-col items-center gap-0.5 rounded-[10px] px-0.5 py-1.5 text-[10.5px] whitespace-nowrap"
            style={{ color: active ? 'var(--gold)' : '#9aa4bd' }}
          >
            {section.id === 'health' && tab.id === 'health' ? (
              <img
                src={section.iconImage}
                alt=""
                className={few ? 'h-8 w-8 object-contain' : 'h-7 w-7 object-contain'}
                style={active ? { transform: 'translateY(-1px)' } : undefined}
              />
            ) : (
              <span className={few ? 'text-[22px] leading-none' : 'text-xl leading-none'} style={active ? { transform: 'translateY(-1px)' } : undefined}>
                {tab.icon}
              </span>
            )}
            <span className={few ? 'text-[11px]' : undefined}>{tab.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
