import { AnimatePresence, motion } from 'framer-motion';
import { useSaveToast } from '@/lib/save-toast';

export function SaveToast() {
  const msg = useSaveToast();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(90px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ background: 'var(--navy)', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
          >
            <span>✓</span>
            <span>{msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
