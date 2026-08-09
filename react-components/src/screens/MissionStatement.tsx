import { useState } from 'react';
import { getLS, setLS } from '@/lib/storage';
import { cloudSaveSetting } from '@/lib/supabase-sync';
import { notifySaved } from '@/lib/save-toast';

export function MissionStatement() {
  const [text, setText] = useState(() => getLS('missionStatement', ''));
  const [saved, setSaved] = useState(false);

  function save() {
    const trimmed = text.trim();
    setLS('missionStatement', trimmed);
    cloudSaveSetting('missionStatement', trimmed);
    notifySaved('Mission statement saved.');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>🧭 Mission Statement</h2>

      <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <p className="mb-3 text-[15px]" style={{ color: 'var(--foreground)' }}>
          <em>7 Habits of Highly Effective People</em>'s Habit 2 — Begin with the End in Mind — teaches that everything
          is created twice: first as a mental picture, then as a physical reality. A personal mission statement is
          that first creation: a written expression of the values you want to live by and the person you want to
          become, written down deliberately instead of left to circumstance.
        </p>
        <p className="text-[15px]" style={{ color: 'var(--foreground)' }}>
          It works like a personal constitution — a fixed point you can return to for decisions, even while
          everything else on your mission changes day to day. Write it once, revisit it often, and let it be what
          actually directs your time here — not just whatever's loudest that day.
        </p>
      </div>

      <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Your Mission Statement</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who do you want to become? What matters most? What will you not compromise on?"
          className="mb-3 min-h-[200px] w-full rounded-xl border p-3 text-base"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        />
        <button type="button" onClick={save} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}
