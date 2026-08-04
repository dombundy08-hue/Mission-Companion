import { getLS, setLS } from './storage';

// PARTIAL PORT: index.html's real `journalPrompts` array has 730 entries
// (index.html:1030-~1760). These 50 are copied verbatim from the start of
// that real array (not fabricated) to get prompt rotation genuinely working
// for this port — copying the remaining ~680 is a mechanical follow-up, not
// done yet. Track via usedPromptIndices same as the vanilla app so progress
// carries over once the rest are added (indices just go further).
export const journalPrompts: string[] = [
  "What moment today made you feel closest to Heavenly Father?",
  "If you could relive one conversation from today, what would you say differently?",
  "What did someone teach you today without knowing they were teaching you?",
  "Where did you see evidence of God's hand working in your area this week?",
  "What fear did you push through today, and what happened when you did?",
  "Describe the face of someone you met today. What did you sense they were carrying?",
  "What scripture came to mind unexpectedly today, and why do you think it did?",
  "How did your relationship with your companion grow today?",
  "What would you tell your future self about today?",
  "What is something you understood about the Atonement in a new way this week?",
  "When did you feel the Spirit most clearly today, and what were you doing?",
  "What prayer of yours was answered in a way you didn't expect?",
  "Who crossed your path today that you can't stop thinking about?",
  "What did you give away today that cost you something?",
  "Where did you fall short today, and how is the Lord inviting you to try again?",
  "What small kindness did someone show you that you almost missed?",
  "What truth do you believe more deeply tonight than you did this morning?",
  "Describe a sound from today that you want to remember.",
  "What did silence teach you today?",
  "How did you see Christ in the face of a stranger?",
  "What burden did you help someone carry today, even briefly?",
  "What question is sitting in your heart tonight that you don't yet have an answer to?",
  "When did you feel most like yourself today?",
  "What did you notice about the city or town you serve in that you'd never seen before?",
  "What promise from the Lord are you holding onto right now?",
  "How did someone surprise you with their openness today?",
  "What part of today would you want your mother to know about?",
  "Where did you sense God was patient with you today?",
  "What did you learn about love by watching someone today?",
  "What hope did you carry into a door, and what came of it?",
  "What did you do today that your younger self would be proud of?",
  "When did weakness become a doorway for grace today?",
  "What words did you speak today that you felt weren't entirely your own?",
  "Describe a moment of beauty you stumbled into today.",
  "What did rejection feel like today, and what did you do with it?",
  "How is the Lord shaping you through this companion?",
  "What did you understand about repentance today that you didn't before?",
  "Who needed your patience today, and how did you respond?",
  "What ordinary moment felt sacred today?",
  "What did you carry home in your heart from your last appointment?",
  "Where did you choose faith over fear today?",
  "What did you learn about yourself from the way you handled disappointment today?",
  "When did you feel the reality of Jesus Christ most today?",
  "What did you notice in someone's eyes that words didn't say?",
  "How did the Lord provide for you today in a small, easy-to-miss way?",
  "What conversation drained you today, and what does that tell you?",
  "What gift of the Spirit did you feel working through you today?",
  "Who do you wish you had been kinder to today?",
  "What did you see God do that you could never have arranged yourself?",
];

// Ported 1:1 from index.html's pickPrompt() — same localStorage key
// (usedPromptIndices), same no-repeat-until-exhausted behavior.
export function pickPrompt(): string {
  let used = getLS<number[]>('usedPromptIndices', []);
  if (!Array.isArray(used)) used = [];
  if (used.length >= journalPrompts.length) used = [];
  const set = new Set(used);
  const avail: number[] = [];
  for (let i = 0; i < journalPrompts.length; i++) {
    if (!set.has(i)) avail.push(i);
  }
  const idx = avail[Math.floor(Math.random() * avail.length)];
  used.push(idx);
  setLS('usedPromptIndices', used);
  return journalPrompts[idx];
}
