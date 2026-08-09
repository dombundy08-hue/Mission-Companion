// Light-touch Covey framework, folded quietly into the Email reflection —
// not a dedicated screen, just a one-line prompt that rotates weekly.
export interface HabitTip {
  habit: string;
  prompt: string;
}

export const SEVEN_HABITS: HabitTip[] = [
  { habit: 'Be Proactive', prompt: 'Did you choose your response to something hard this week, instead of just reacting?' },
  { habit: 'Begin with the End in Mind', prompt: 'Did your actions this week point toward why you came on a mission?' },
  { habit: 'Put First Things First', prompt: 'Did the most important things (study, teaching, your companion) get your best time, not just your leftover time?' },
  { habit: 'Think Win-Win', prompt: 'Was there a moment this week you and your companion (or a Friend) both came out ahead?' },
  { habit: 'Seek First to Understand, Then to Be Understood', prompt: 'Did you really listen to someone this week before trying to be understood yourself?' },
  { habit: 'Synergize', prompt: 'Did working with your companion produce something neither of you would have alone?' },
  { habit: 'Sharpen the Saw', prompt: 'Did your study this week actually renew you, or just check a box?' },
];

function weekIndex(): number {
  const start = new Date(new Date().getFullYear(), 0, 1).getTime();
  const weeks = Math.floor((Date.now() - start) / (7 * 86400000));
  return weeks % SEVEN_HABITS.length;
}

export function thisWeeksHabitTip(): HabitTip {
  return SEVEN_HABITS[weekIndex()];
}
