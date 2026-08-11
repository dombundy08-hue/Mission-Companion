// Pre-fills Demo Mode with realistic, generic (never-real) sample data so
// clicking "Try Demo Mode" shows a fully lived-in account instead of a blank
// app — useful for sales demos without exposing any real user's data.
// Every date is computed relative to `Date.now()` at seed time, so the
// "history" always looks current no matter when someone actually clicks in.
// Called from AuthContext's `unlockDemo()`, right after `localStorage.clear()`.
import { setLS, uid } from './storage';
import { fmtDateTime } from './format';
import { SCRIPTURE_DEFAULTS } from './scripture-data';
import type { DeckCard, Streak } from './mastery';
import { isoDate } from './health-data';
import type { HealthGoals } from './health-data';
import type { Routine, RoutinePart, WorkoutLogEntry, WorkoutProgram, ActiveProgram } from './exercise-data';

interface JournalEntry {
  id: string;
  date: string;
  timestamp: number;
  body: string;
  reflectionPrompt?: string;
  reflectionResponse?: string;
}
interface MiracleEntry {
  id: string;
  date: string;
  timestamp: number;
  body: string;
}

const SPAN_WEEKS = 7;
const SPAN_DAYS = SPAN_WEEKS * 7;

function dateAgo(daysAgo: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}
// Same local-date format mastery.ts's (unexported) dayKey() uses.
function dayKey(d: Date): string {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}
// Deterministic — same seed always produces the same value, so the whole
// dataset is identical for every person on every click, not regenerated
// randomly each time. Callers pass a fixed, distinct seed per quantity
// (day offset, meal index, etc.) rather than relying on Math.random() state.
function seededRand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x); // 0..1
}
function jitter(seed: number, base: number, spread: number): number {
  return base + (seededRand(seed) * 2 - 1) * spread;
}

/* ---------- Journal ---------- */
const JOURNAL_BODIES = [
  "Companion and I taught a family of four tonight and the dad asked if he could pray at the end. First time he's offered. Small thing, but it felt huge.",
  "Rode bikes in the rain for most of the afternoon and nobody answered a single door. Easy to feel discouraged, but we sang hymns the whole ride back and it turned the day around.",
  "Had a long talk with my companion about why we're really out here. Grateful for someone who pushes me to be better every day.",
  "A less-active member let us in today after months of the door being closed. She cried during the lesson. I don't think I'll forget her face.",
  "Studied Alma 32 this morning and it hit different this time — the part about the seed and patience. Feels like exactly where I'm at right now.",
  "Long day, sore feet, and a lesson that completely fell apart halfway through. Still glad we went. Trying to remember it's not about the numbers.",
  "Met someone at the bus stop who used to be a member decades ago. We talked for twenty minutes. Exchanged information — hoping we can follow up.",
  "Finally understood something about the Atonement today that I've read a hundred times but never really felt until now.",
  "Zone conference today. Needed it more than I realized — easy to get in a rut out here and forget why any of this matters.",
  "We fasted together as a district this week for one particular family. Nothing dramatic happened, but I felt peace about it anyway.",
  "Taught the Restoration lesson for probably the fiftieth time and it still isn't old. Watching it click for someone never gets old either.",
  "Hard day. Doubted myself a lot. Companion reminded me that this isn't really about being good at it, it's about showing up.",
  "Got invited to dinner with a family in the ward and just sat and listened to their story for two hours. Reminded me why I love this area.",
  "Wrote letters home tonight instead of going straight to bed. Felt homesick but also strangely grateful for exactly where I am.",
  "We helped a family move today instead of finding new investigators. Felt like the more Christlike use of the afternoon.",
  "Someone we'd almost given up on texted us asking to meet again. Never assume a door is closed for good.",
  "Practiced the language for an hour before bed. Still mixing up my verb tenses but getting a little more confident every week.",
  "Quiet day, not much to report, but grateful for the quiet ones too. Not every day has to be dramatic to matter.",
  "We were turned away three times in a row today and then had one of the best lessons of the transfer right after. The Lord's timing, not mine.",
  "Companion exchange today — learned a lot just watching someone else teach. Going to try borrowing a few of their questions.",
];

const REFLECTION_PROMPTS = [
  "Where did you see evidence of God's hand working in your area this week?",
  "When did you feel the Spirit most clearly today, and what were you doing?",
  "What did someone teach you today without knowing they were teaching you?",
  "How did your relationship with your companion grow today?",
  "What promise from the Lord are you holding onto right now?",
  "Where did you choose faith over fear today?",
];
const REFLECTION_RESPONSES = [
  "Honestly it was in the small stuff today — a door opening right when we needed it to, a scripture coming to mind at exactly the right moment.",
  "Sitting with that family and just listening. Didn't say much, but it felt like the most important part of the day.",
  "Realizing I still get nervous knocking on doors and that's okay. Trying to lean into it instead of around it.",
  "We've been praying specifically for one family for weeks now. Still nothing visible, but I trust it matters.",
  "Choosing to go back to a door we'd been avoided at before, even though it was uncomfortable.",
];

function seedJournal() {
  const entries: JournalEntry[] = JOURNAL_BODIES.map((body, i) => {
    const daysAgo = Math.round((i / (JOURNAL_BODIES.length - 1)) * (SPAN_DAYS - 1));
    const d = dateAgo(SPAN_DAYS - 1 - daysAgo, 20 + (i % 2), 10 * (i % 6));
    const withReflection = i % 3 === 1;
    return {
      id: uid(),
      date: fmtDateTime(d),
      timestamp: d.getTime(),
      body,
      ...(withReflection
        ? {
            reflectionPrompt: pick(REFLECTION_PROMPTS, i),
            reflectionResponse: pick(REFLECTION_RESPONSES, i),
          }
        : {}),
    };
  });
  setLS('journalEntries', entries);
}

/* ---------- Miracles ---------- */
const MIRACLE_BODIES = [
  "We were completely out of ideas for who to visit and a woman literally stopped us on the street asking about our badges. We're teaching her now.",
  "Prayed specifically that our lesson would go well despite feeling unprepared, and it ended up being one of the best lessons we've ever taught.",
  "A referral came in from a member exactly the same week the person we were praying for said they finally felt ready to meet.",
  "Ran out of gas on our bikes' water bottles in the heat and a stranger handed us two cold waters without us saying a word.",
  "An investigator who'd gone quiet for a month messaged us out of nowhere asking when we could meet again.",
  "Felt strongly we should knock one more door before heading in for the night. That door became one of our best new investigators.",
  "A member who'd been struggling in her faith told us our visit was the exact answer to a prayer she'd said that morning.",
  "We felt prompted to change our plans last minute and ran into someone we'd been trying to find for two weeks.",
  "An investigator's whole extended family showed up unannounced to our lesson and asked to be taught too.",
  "Someone we taught months ago in a different area recognized us and told us they'd been baptized since we left.",
  "We had exactly enough time to fit one more visit before curfew, and that visit turned into a baptismal date.",
  "A door we almost skipped turned out to be someone who'd been praying for missionaries to find them for weeks.",
];

function seedMiracles() {
  const entries: MiracleEntry[] = MIRACLE_BODIES.map((body, i) => {
    const daysAgo = Math.round((i / (MIRACLE_BODIES.length - 1)) * (SPAN_DAYS - 2));
    const d = dateAgo(SPAN_DAYS - 2 - daysAgo, 19, 15 * (i % 4));
    return { id: uid(), date: fmtDateTime(d), timestamp: d.getTime() };
  }).map((e, i) => ({ ...e, body: MIRACLE_BODIES[i] }));
  setLS('miracleEntries', entries);
}

/* ---------- Scripture Mastery ---------- */
function seedMastery() {
  const deck: DeckCard[] = SCRIPTURE_DEFAULTS.map((c, i) => {
    const touched = i % 5 !== 0; // ~80% of cards have been practiced at least once
    if (!touched) return { ...c, confidence: 0, reviewCount: 0, lastReviewed: null };
    const confidence = 1 + (i % 5); // spread 1-5
    const reviewCount = 1 + (i % 8);
    const daysAgo = i % 6; // reviewed at various recent points
    const reviewed = dateAgo(daysAgo, 21, 0);
    return { ...c, confidence, reviewCount, lastReviewed: reviewed.toISOString() };
  });
  setLS('scriptureDeck', deck);

  const streak: Streak = { count: 28, last: dayKey(new Date()) };
  setLS('scriptureStreak', streak);
}

/* ---------- Workouts ---------- */
function repPart(items: { name: string; sets: number; reps: number | null; rest: number; note?: string }[]): RoutinePart {
  return { kind: 'part', type: 'rep', items };
}
function timedPart(items: { name: string; seconds: number }[]): RoutinePart {
  return { kind: 'part', type: 'timed', items };
}

function seedWorkouts() {
  const createdAt = dateAgo(SPAN_DAYS - 1).getTime();
  const routines: Routine[] = [
    {
      id: uid(),
      name: 'Push Day',
      createdAt,
      steps: [
        repPart([
          { name: 'Push-ups', sets: 3, reps: 15, rest: 45 },
          { name: 'Bench Dips', sets: 3, reps: 12, rest: 45 },
          { name: 'Pike Push-ups', sets: 3, reps: 10, rest: 45 },
          { name: 'Tricep Extensions', sets: 3, reps: 12, rest: 30 },
        ]),
      ],
    },
    {
      id: uid(),
      name: 'Pull Day',
      createdAt,
      steps: [
        repPart([
          { name: 'Pull-ups', sets: 3, reps: 8, rest: 60 },
          { name: 'Inverted Rows', sets: 3, reps: 12, rest: 45 },
          { name: 'Bicep Curls', sets: 3, reps: 12, rest: 30 },
          { name: 'Superman Hold', sets: 3, reps: null, rest: 30, note: '20-30 seconds' },
        ]),
      ],
    },
    {
      id: uid(),
      name: 'Leg Day',
      createdAt,
      steps: [
        repPart([
          { name: 'Squats', sets: 4, reps: 15, rest: 45 },
          { name: 'Walking Lunges', sets: 3, reps: 12, rest: 45, note: 'each leg' },
          { name: 'Glute Bridges', sets: 3, reps: 15, rest: 30 },
          { name: 'Calf Raises', sets: 3, reps: 20, rest: 30 },
        ]),
      ],
    },
    {
      id: uid(),
      name: 'Morning Cardio',
      createdAt,
      steps: [
        timedPart([
          { name: 'Jumping Jacks', seconds: 45 },
          { name: 'High Knees', seconds: 45 },
          { name: 'Mountain Climbers', seconds: 45 },
          { name: 'Rest', seconds: 20 },
          { name: 'Jump Rope', seconds: 60 },
          { name: 'Burpees', seconds: 40 },
        ]),
      ],
    },
  ];
  setLS('workoutRoutines', routines);

  const log: WorkoutLogEntry[] = [];
  let dayCursor = SPAN_DAYS - 2;
  let routineIdx = 0;
  while (dayCursor > 0) {
    const routine = routines[routineIdx % routines.length];
    const d = dateAgo(dayCursor, 6, 30 + (routineIdx % 3) * 5);
    log.push({
      id: uid(),
      routineName: routine.name,
      date: fmtDateTime(d),
      timestamp: d.getTime(),
      durationSec: Math.round(jitter(routineIdx, 1500, 300)),
      stepsCompleted: (routine.steps[0] as { items: unknown[] }).items.length,
    });
    routineIdx++;
    dayCursor -= [1, 2][routineIdx % 2]; // roughly 3-4x/week cadence
  }
  setLS('workoutLog', log);

  const program: WorkoutProgram = {
    id: uid(),
    name: '3-Day Split',
    routineIds: [routines[0].id, routines[1].id, routines[2].id],
    createdAt: dateAgo(21).getTime(),
  };
  setLS('workoutPrograms', [program]);

  const active: ActiveProgram = { programId: program.id, startDate: isoDate() };
  setLS('activeWorkoutProgram', active);
}

/* ---------- Health ---------- */
// Grouped by meal slot (rather than one flat pool) so daily totals land
// close to the seeded goals below instead of drifting arbitrarily low.
const BREAKFASTS = [
  { name: 'Scrambled eggs & toast', cal: 380, prot: 22 },
  { name: 'Oatmeal with peanut butter', cal: 420, prot: 16 },
  { name: 'Greek yogurt & granola', cal: 360, prot: 20 },
  { name: 'Cereal with milk', cal: 320, prot: 12 },
];
const LUNCHES = [
  { name: 'Turkey sandwich', cal: 520, prot: 30 },
  { name: 'Beans and rice', cal: 560, prot: 22 },
  { name: 'Grilled cheese & tomato soup', cal: 540, prot: 19 },
  { name: 'Chicken burrito bowl', cal: 620, prot: 36 },
];
const DINNERS = [
  { name: 'Grilled chicken & rice', cal: 680, prot: 45 },
  { name: 'Pasta with meat sauce', cal: 700, prot: 34 },
  { name: 'Baked salmon & vegetables', cal: 640, prot: 40 },
  { name: 'Ground beef tacos', cal: 660, prot: 36 },
];
const SNACKS = [
  { name: 'Protein shake', cal: 220, prot: 30 },
  { name: 'Apple & string cheese', cal: 200, prot: 9 },
  { name: 'Peanut butter & jelly sandwich', cal: 380, prot: 14 },
  { name: 'Trail mix', cal: 260, prot: 8 },
];

function seedHealth() {
  const goals: HealthGoals = {
    profile: {
      units: 'imperial',
      age: '23',
      sex: 'male',
      heightFt: '5',
      heightIn: '10',
      heightCm: '',
      weight: '168',
      activity: 'moderate',
      goalWeight: '160',
    },
    calories: 2300,
    protein: 120,
    sleep: 7.5,
    water: 80,
    weightCeiling: null,
  };
  setLS('healthGoals', goals);
  setLS('health_visibleMetrics', ['calories', 'protein', 'sleep', 'water', 'mood', 'energy', 'weight']);

  const food: Record<string, unknown>[] = [];
  const weight: Record<string, unknown>[] = [];
  const sleep: Record<string, unknown>[] = [];
  const water: Record<string, unknown>[] = [];
  const mood: Record<string, unknown>[] = [];

  let w = 168;
  for (let daysAgo = SPAN_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const dateStr = isoDate(dateAgo(daysAgo));

    const meals: { name: string; cal: number; prot: number; hour: number }[] = [
      { ...pick(BREAKFASTS, daysAgo), hour: 8 },
      { ...pick(LUNCHES, daysAgo + 1), hour: 12 },
      { ...pick(DINNERS, daysAgo + 2), hour: 18 },
    ];
    if (daysAgo % 3 !== 0) meals.push({ ...pick(SNACKS, daysAgo + 3), hour: 21 }); // snack ~2/3 of days
    meals.forEach((f, m) => {
      const t = dateAgo(daysAgo, f.hour, (m * 17) % 60);
      food.push({
        id: uid(),
        entryDate: dateStr,
        timestamp: t.getTime(),
        description: f.name,
        calories: Math.round(jitter(daysAgo * 4 + m, f.cal, 40)),
        protein: Math.round(jitter(daysAgo * 4 + m + 100, f.prot, 4)),
        source: 'estimate',
      });
    });

    w += jitter(daysAgo, 0, 0.35) - 0.03; // gentle overall downward drift toward goal weight
    weight.push({ id: uid(), entryDate: dateStr, timestamp: dateAgo(daysAgo, 7, 0).getTime(), weight: Math.round(w * 10) / 10 });

    sleep.push({ id: uid(), entryDate: dateStr, timestamp: dateAgo(daysAgo, 6, 45).getTime(), hours: Math.round(jitter(daysAgo * 3 + 1, 7.3, 0.9) * 10) / 10 });

    const taps = 3 + (daysAgo % 4 === 0 ? 1 : 0);
    for (let t = 0; t < taps; t++) {
      const ts = dateAgo(daysAgo, 8 + t * 3, (t * 23) % 60);
      water.push({ id: uid(), entryDate: dateStr, timestamp: ts.getTime(), oz: Math.round(jitter(daysAgo * 10 + t, 20, 5)) });
    }

    mood.push({
      id: uid(),
      entryDate: dateStr,
      timestamp: dateAgo(daysAgo, 21, 30).getTime(),
      score: Math.max(1, Math.min(5, Math.round(jitter(daysAgo * 5 + 2, 4, 1)))),
      energy: Math.max(1, Math.min(5, Math.round(jitter(daysAgo * 5 + 3, 3.5, 1)))),
    });
  }

  setLS('healthFood', food);
  setLS('healthWeight', weight);
  setLS('healthSleep', sleep);
  setLS('healthWater', water);
  setLS('healthMood', mood);
}

export function seedDemoData(): void {
  seedJournal();
  seedMiracles();
  seedMastery();
  seedWorkouts();
  seedHealth();
}
