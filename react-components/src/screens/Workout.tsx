import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getRoutines,
  routineParts,
  routineMeta,
  routineBadge,
  fmtClock,
  isRest,
  expandCircuit,
  logWorkout,
  type Routine,
  type RoutinePart,
  type TimedItem,
  type RepItem,
} from '@/lib/exercise-data';
import { fmtDateTime } from '@/lib/format';
import { uid } from '@/lib/storage';
import { speak, beep, primeAudio, cancelSpeech } from '@/lib/audio';
import { setWorkoutActive } from '@/lib/workout-session';
import { notifySaved } from '@/lib/save-toast';

interface Session {
  routineId: string;
  routineName: string;
  parts: RoutinePart[];
  idx: number;
  startedAt: number;
  completed: number;
  active: boolean;
}
interface WorkoutState {
  kind: 'timed' | 'rep';
  view: 'pick' | 'ready' | 'run' | 'done';
  steps: TimedItem[];
  stepIdx: number;
  remaining: number;
  running: boolean;
  countdown: number;
}
interface RepState {
  steps: RepItem[];
  counts: number[];
  restLeft: number[];
}

const badgeClass = (bd: string) => (bd === 'Reps' ? '#2CD758' : bd === 'Mixed' ? '#A355FF' : bd === 'Circuit' ? '#FF6B35' : '#1C6FB0');

export function Workout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [routines] = useState<Routine[]>(() => getRoutines());
  const [session, setSession] = useState<Session | null>(null);
  const [w, setW] = useState<WorkoutState>({ kind: 'timed', view: 'pick', steps: [], stepIdx: 0, remaining: 0, running: false, countdown: 3 });
  const [rep, setRep] = useState<RepState>({ steps: [], counts: [], restLeft: [] });
  const [lastLog, setLastLog] = useState<{ durationSec: number } | null>(null);

  const sessionRef = useRef(session);
  const wRef = useRef(w);
  const repRef = useRef(rep);
  sessionRef.current = session;
  wRef.current = w;
  repRef.current = rep;

  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const leadTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const leadToken = useRef(0);
  const restTimers = useRef<(ReturnType<typeof setInterval> | null)[]>([]);

  function clearLeadTimers() {
    leadTimers.current.forEach((id) => clearTimeout(id));
    leadTimers.current = [];
    leadToken.current++;
  }
  function stopTimer() {
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    clearLeadTimers();
    restTimers.current.forEach((id) => { if (id) clearInterval(id); });
    restTimers.current = repRef.current.steps.map(() => null);
    cancelSpeech();
  }

  useEffect(() => {
    setWorkoutActive(!!session?.active);
  }, [session?.active]);

  useEffect(() => () => {
    stopTimer();
    setWorkoutActive(false);
  }, []);

  function partPrefix(ss: Session) {
    return ss.parts.length > 1 ? `Part ${ss.idx + 1} of ${ss.parts.length} · ` : '';
  }

  function logSession(ss: Session) {
    const durationSec = Math.round((Date.now() - ss.startedAt) / 1000);
    logWorkout({ id: uid(), routineName: ss.routineName, date: fmtDateTime(new Date()), timestamp: Date.now(), durationSec, stepsCompleted: ss.completed });
    setLastLog({ durationSec });
    notifySaved('Workout logged.');
  }
  function finishSession() {
    const ss = sessionRef.current;
    if (!ss) return;
    stopTimer();
    logSession(ss);
    speak('Workout complete. Nice work.');
    setSession({ ...ss, active: false });
    setW((prev) => ({ ...prev, view: 'done' }));
  }
  function endSession() {
    const ss = sessionRef.current;
    if (!ss || !ss.active) {
      setW((prev) => ({ ...prev, view: 'pick' }));
      return;
    }
    stopTimer();
    if (ss.completed > 0) {
      logSession(ss);
      speak('Workout ended. Logged.');
      setSession({ ...ss, active: false });
      setW((prev) => ({ ...prev, view: 'done' }));
    } else {
      speak('Workout ended.');
      setSession({ ...ss, active: false });
      setW((prev) => ({ ...prev, view: 'pick' }));
    }
  }
  function cancelSession() {
    setSession((s) => (s ? { ...s, active: false } : s));
    stopTimer();
    setW((prev) => ({ ...prev, view: 'pick' }));
  }

  function sessionPartDone() {
    const ss = sessionRef.current;
    if (!ss) return;
    stopTimer();
    if (!ss.active) return;
    if (ss.idx >= ss.parts.length - 1) return finishSession();
    const nextIdx = ss.idx + 1;
    setSession({ ...ss, idx: nextIdx });
    runSessionPart(ss, nextIdx, true);
  }

  function tickStart() {
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = setInterval(() => {
      if (!wRef.current.running) return;
      const remaining = wRef.current.remaining - 1;
      if (remaining <= 0) {
        nextStep();
      } else {
        if (remaining <= 3) beep(660, 150, 0.25);
        setW((prev) => ({ ...prev, remaining }));
      }
    }, 1000);
  }
  function announceStep(steps: TimedItem[], idx: number) {
    const s = steps[idx];
    if (!s) return;
    speak(isRest(s.name) ? 'Rest.' : s.name);
  }
  function nextStep() {
    const ss = sessionRef.current;
    const cur = wRef.current;
    if (!ss) return;
    const completed = ss.completed + 1;
    setSession({ ...ss, completed });
    sessionRef.current = { ...ss, completed };
    if (cur.stepIdx >= cur.steps.length - 1) return sessionPartDone();
    const stepIdx = cur.stepIdx + 1;
    const remaining = cur.steps[stepIdx].seconds || 45;
    announceStep(cur.steps, stepIdx);
    setW((prev) => ({ ...prev, stepIdx, remaining }));
  }

  function runLeadIn(ss: Session, steps: TimedItem[], isAdvance: boolean) {
    clearLeadTimers();
    const token = leadToken.current;
    const alive = () => wRef.current.view === 'ready' && leadToken.current === token && sessionRef.current?.active;
    const first = steps[0] || { name: '', seconds: 0 };
    const many = ss.parts.length > 1;
    const intro = isAdvance && many ? `Part ${ss.idx + 1}. First up: ${first.name}.` : `Starting ${ss.routineName}. First up: ${first.name}.`;
    const countdown = () => {
      if (!alive()) return;
      let n = 3;
      const tick = () => {
        if (!alive()) return;
        if (n > 0) {
          setW((prev) => ({ ...prev, countdown: n }));
          beep(660, 170, 0.28);
          n--;
          leadTimers.current.push(setTimeout(tick, 1000));
        } else {
          setW((prev) => ({ ...prev, countdown: 0 }));
          beep(990, 340, 0.32);
          speak('Begin!');
          leadTimers.current.push(
            setTimeout(() => {
              if (!alive()) return;
              setW((prev) => ({ ...prev, view: 'run', running: true }));
              tickStart();
            }, 750)
          );
        }
      };
      tick();
    };
    speak(intro, { onEnd: countdown });
  }

  function startTimedPart(ss: Session, part: RoutinePart, isAdvance: boolean) {
    const steps = part.type === 'circuit' ? expandCircuit(part) : (part.items as TimedItem[]).filter((x) => x && x.name).map((s) => ({ name: s.name, seconds: s.seconds || 45 }));
    if (!steps.length) return sessionPartDone();
    setW({ kind: 'timed', view: 'ready', steps, stepIdx: 0, remaining: steps[0].seconds || 45, running: false, countdown: 3 });
    setTimeout(() => runLeadIn(ss, steps, isAdvance), 0);
  }

  function startRepPart(ss: Session, part: RoutinePart, isAdvance: boolean) {
    const steps = (part.items as RepItem[]).filter((x) => x && x.name);
    if (!steps.length) return sessionPartDone();
    restTimers.current = steps.map(() => null);
    setRep({ steps, counts: steps.map(() => 0), restLeft: steps.map(() => 0) });
    setW((prev) => ({ ...prev, kind: 'rep', view: 'run' }));
    const many = ss.parts.length > 1;
    const lead = isAdvance && many ? `Part ${ss.idx + 1}. ` : `Starting ${ss.routineName}. `;
    speak(lead + 'Log a set on any exercise to begin.');
  }

  function runSessionPart(ss: Session, idx: number, isAdvance: boolean) {
    if (!ss.active) return;
    const part = ss.parts[idx];
    if (!part) return finishSession();
    if (part.type === 'rep') startRepPart(ss, part, isAdvance);
    else startTimedPart(ss, part, isAdvance);
  }

  function startRoutine(id: string) {
    const r = routines.find((x) => x.id === id);
    if (!r) return;
    const parts = routineParts(r);
    if (!parts.length || parts.every((p) => !(p.items || []).filter((x) => x && x.name).length)) {
      alert('That routine is empty.');
      return;
    }
    stopTimer();
    primeAudio();
    const ss: Session = { routineId: id, routineName: r.name, parts, idx: 0, startedAt: Date.now(), completed: 0, active: true };
    setSession(ss);
    sessionRef.current = ss;
    runSessionPart(ss, 0, false);
  }

  // auto-start from ?start=<routineId>
  useEffect(() => {
    const start = params.get('start');
    if (start && !sessionRef.current) {
      startRoutine(start);
      navigate('/exercise/workout', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePause() {
    setW((prev) => {
      const running = !prev.running;
      if (!running) cancelSpeech();
      return { ...prev, running };
    });
  }

  function startRepRest(i: number, s: RepItem) {
    const rest = s.rest || 0;
    if (restTimers.current[i]) {
      clearInterval(restTimers.current[i]!);
      restTimers.current[i] = null;
    }
    if (rest <= 0) {
      setRep((prev) => ({ ...prev, restLeft: prev.restLeft.map((v, idx) => (idx === i ? 0 : v)) }));
      return;
    }
    setRep((prev) => ({ ...prev, restLeft: prev.restLeft.map((v, idx) => (idx === i ? rest : v)) }));
    restTimers.current[i] = setInterval(() => {
      const left = repRef.current.restLeft[i] - 1;
      if (left <= 0) {
        clearInterval(restTimers.current[i]!);
        restTimers.current[i] = null;
        beep(880, 200, 0.25);
        speak('Rest over. ' + s.name + ', next set.');
        setRep((prev) => ({ ...prev, restLeft: prev.restLeft.map((v, idx) => (idx === i ? 0 : v)) }));
      } else {
        if (left <= 3) beep(660, 150, 0.25);
        setRep((prev) => ({ ...prev, restLeft: prev.restLeft.map((v, idx) => (idx === i ? left : v)) }));
      }
    }, 1000);
  }
  function repLogSet(i: number) {
    const cur = repRef.current;
    const s = cur.steps[i];
    if (!s) return;
    const target = s.sets || 1;
    if ((cur.restLeft[i] || 0) > 0 || (cur.counts[i] || 0) >= target) return;
    const counts = cur.counts.map((v, idx) => (idx === i ? v + 1 : v));
    const ss = sessionRef.current;
    if (ss) {
      const completed = ss.completed + 1;
      setSession({ ...ss, completed });
      sessionRef.current = { ...ss, completed };
    }
    setRep((prev) => ({ ...prev, counts }));
    repRef.current = { ...cur, counts };
    if (counts[i] >= target) {
      const allDone = cur.steps.every((s2, idx2) => counts[idx2] >= (s2.sets || 1));
      if (allDone) {
        restTimers.current.forEach((id) => { if (id) clearInterval(id); });
        restTimers.current = cur.steps.map(() => null);
        sessionPartDone();
      }
    } else {
      startRepRest(i, s);
    }
  }

  const goRoutines = () => navigate('/exercise/routines');

  // ---------- render ----------
  if (w.view === 'done') {
    const mins = Math.max(1, Math.round((lastLog?.durationSec || 0) / 60) || 1);
    return (
      <div>
        <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>▶️ Workout</h2>
        <div className="mb-4 rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-2 text-3xl">✅</div>
          <h3 className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>Workout complete</h3>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{session?.completed || 0} completed · about {mins} minute{mins === 1 ? '' : 's'}. Logged.</p>
        </div>
        <button type="button" onClick={() => { setW({ kind: 'timed', view: 'pick', steps: [], stepIdx: 0, remaining: 0, running: false, countdown: 3 }); setSession(null); }} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Do Another</button>
      </div>
    );
  }

  if (session?.active && w.kind === 'rep') {
    return (
      <div>
        <h2 className="mb-2 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>▶️ {session.routineName}</h2>
        <div className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>{partPrefix(session)}Tap "Log Set" on any exercise, in any order. Rest is announced out loud.</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rep.steps.map((s, i) => {
            const target = s.sets || 1;
            const done = rep.counts[i] || 0;
            const complete = done >= target;
            const resting = (rep.restLeft[i] || 0) > 0;
            return (
              <div key={i} className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: complete ? 'var(--secondary)' : 'var(--card)' }}>
                <div className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>{s.name}{s.reps != null ? <span className="ml-1 text-xs font-normal" style={{ color: 'var(--muted-foreground)' }}>× {s.reps} reps</span> : null}</div>
                {s.note && <div className="mb-1 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{s.note}</div>}
                <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>Set {done} of {target}</div>
                {complete ? (
                  <button type="button" disabled className="w-full rounded-xl py-2.5 text-sm font-bold" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>Done ✓</button>
                ) : resting ? (
                  <button type="button" disabled className="w-full rounded-xl py-2.5 text-sm font-bold" style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}>Rest {fmtClock(rep.restLeft[i])}</button>
                ) : (
                  <button type="button" onClick={() => repLogSet(i)} className="w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Log Set</button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={endSession} className="mt-4 w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>End Workout</button>
      </div>
    );
  }

  if (session?.active && w.view === 'ready') {
    const first = w.steps[0] || { name: '' };
    return (
      <div className="text-center">
        <div className="mb-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{partPrefix(session)}Get ready</div>
        <div className="mb-6 text-xl font-bold" style={{ color: 'var(--foreground)' }}>First up: {first.name}</div>
        <div className="mb-6 text-6xl font-bold" style={{ color: 'var(--primary)' }}>{w.countdown > 0 ? w.countdown : 'GO'}</div>
        <div className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>{session.routineName}</div>
        <button type="button" onClick={cancelSession} className="rounded-xl px-6 py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Cancel</button>
      </div>
    );
  }

  if (session?.active && w.view === 'run') {
    const s = w.steps[w.stepIdx] || { name: '', seconds: 0 };
    const total = s.seconds || 1;
    const pct = Math.max(0, Math.min(100, ((total - w.remaining) / total) * 100));
    const next = w.steps[w.stepIdx + 1];
    return (
      <div className="text-center">
        <div className="mb-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>{partPrefix(session)}Step {w.stepIdx + 1} of {w.steps.length}</div>
        <div className="mb-4 text-xl font-bold" style={{ color: 'var(--foreground)' }}>{s.name}</div>
        <div className="mb-3 text-6xl font-bold" style={{ color: isRest(s.name) ? 'var(--gold-dark)' : 'var(--primary)' }}>{fmtClock(w.remaining)}</div>
        <div className="mx-auto mb-4 h-2 max-w-sm overflow-hidden rounded-full" style={{ background: 'var(--secondary)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
        </div>
        <div className="mb-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>{next ? `Next: ${next.name}` : 'Last step of this part'}</div>
        <div className="mb-3 flex justify-center gap-3">
          <button type="button" onClick={togglePause} className="rounded-xl px-5 py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>{w.running ? '⏸ Pause' : '▶ Resume'}</button>
          <button type="button" onClick={nextStep} className="rounded-xl px-5 py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>⏭ Skip</button>
        </div>
        <button type="button" onClick={endSession} className="rounded-xl px-6 py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>End Workout</button>
      </div>
    );
  }

  // pick view
  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>▶️ Workout</h2>
      {!routines.length ? (
        <div className="mb-4 rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-2 text-3xl">💪</div>
          <h3 className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>No routines yet</h3>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Build one in the Routines tab, then start it here. Steps are announced out loud as you go.</p>
          <button type="button" onClick={goRoutines} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Go to Routines</button>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>Pick a routine to begin.</div>
          <div className="space-y-2.5">
            {routines.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((r) => {
              const bd = routineBadge(r);
              return (
                <div key={r.id} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--foreground)' }}>{r.name}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: badgeClass(bd) }}>{bd}</span>
                  </div>
                  <div className="mb-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{routineMeta(r)}</div>
                  <button type="button" onClick={() => startRoutine(r.id)} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>▶ Start</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
