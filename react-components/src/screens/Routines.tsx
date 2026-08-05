import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRoutines,
  saveRoutine,
  routineParts,
  routineMeta,
  routineBadge,
  partSummary,
  partTotalSec,
  fmtClock,
  clonePart,
  SAMPLE_ROUTINE,
  BUILT_IN_WORKOUTS,
  getPrograms,
  saveProgram,
  deleteProgram,
  getActiveProgram,
  setActiveProgram,
  todaysProgramSlot,
  type BuiltInWorkout,
  type Routine,
  type RoutinePart,
  type TimedItem,
  type RepItem,
  type CircuitItem,
  type WorkoutProgram,
} from '@/lib/exercise-data';
import { setLS, getLS, uid } from '@/lib/storage';
import { cloudSaveRoutine, cloudDeleteRow, fetchSharedPrograms, postSharedProgram, likeSharedProgram, type SharedProgram } from '@/lib/supabase-sync';
import { programSnapshot, importSharedProgram } from '@/lib/exercise-data';

type View = 'list' | 'pick-part' | 'edit-timed' | 'edit-rep' | 'edit-circuit' | 'assemble' | 'programs' | 'program-edit' | 'community';
type PartType = 'timed' | 'rep' | 'circuit';

interface Build {
  name: string;
  parts: RoutinePart[];
  editIdx: number | null;
}

function newBuild(): Build {
  return { name: '', parts: [], editIdx: null };
}

const badgeClass = (bd: string) => (bd === 'Reps' ? 'rep' : bd === 'Mixed' ? 'mixed' : bd === 'Circuit' ? 'circuit' : 'timed');
const badgeColor: Record<string, string> = { rep: '#2CD758', mixed: '#A355FF', circuit: '#FF6B35', timed: '#1C6FB0' };

export function Routines() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('list');
  const [routines, setRoutines] = useState<Routine[]>(() => getRoutines());
  const [editId, setEditId] = useState<string | null>(null);
  const [build, setBuild] = useState<Build>(newBuild());
  const [flash, setFlash] = useState<string | null>(null);
  const [programs, setPrograms] = useState<WorkoutProgram[]>(() => getPrograms());
  const [activeProgram, setActiveProgramState] = useState(() => getActiveProgram());
  const [programEditId, setProgramEditId] = useState<string | null>(null);
  const [programName, setProgramName] = useState('');
  const [programRoutineIds, setProgramRoutineIds] = useState<string[]>([]);
  const [shared, setShared] = useState<SharedProgram[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [likedIds, setLikedIds] = useState<string[]>(() => getLS('likedSharedPrograms', []));

  useEffect(() => {
    if (view !== 'community') return;
    setSharedLoading(true);
    fetchSharedPrograms().then((rows) => {
      setShared(rows);
      setSharedLoading(false);
    });
  }, [view]);

  const [draftTimed, setDraftTimed] = useState<TimedItem[]>([{ name: '', seconds: 45 }]);
  const [draftRep, setDraftRep] = useState<RepItem[]>([{ name: '', sets: 3, reps: null, rest: 60, note: '' }]);
  const [draftCircuit, setDraftCircuit] = useState<{ rounds: number; work: number; rest: number; restRounds: number; items: CircuitItem[] }>({ rounds: 3, work: 40, rest: 15, restRounds: 30, items: [{ name: '' }] });

  function say(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1900);
  }
  function refresh() {
    setRoutines(getRoutines());
  }

  function startNew() {
    setEditId(null);
    setBuild(newBuild());
    setView('pick-part');
  }
  function addSample() {
    const r: Routine = { id: uid(), name: SAMPLE_ROUTINE.name, steps: SAMPLE_ROUTINE.steps.map((s) => ({ ...s })), createdAt: Date.now() };
    saveRoutine(r);
    refresh();
    say('Sample routine added.');
  }
  function useTemplate(t: BuiltInWorkout) {
    const r: Routine = { id: uid(), name: t.name, steps: t.parts.map(clonePart), createdAt: Date.now() };
    saveRoutine(r);
    refresh();
    say(`"${t.name}" added — edit it however you like.`);
  }

  function refreshPrograms() {
    setPrograms(getPrograms());
    setActiveProgramState(getActiveProgram());
  }
  function startNewProgram() {
    setProgramEditId(null);
    setProgramName('');
    setProgramRoutineIds([]);
    setView('program-edit');
  }
  function editProgram(p: WorkoutProgram) {
    setProgramEditId(p.id);
    setProgramName(p.name);
    setProgramRoutineIds([...p.routineIds]);
    setView('program-edit');
  }
  function addRoutineToProgram(id: string) {
    setProgramRoutineIds((arr) => [...arr, id]);
  }
  function removeProgramDay(idx: number) {
    setProgramRoutineIds((arr) => arr.filter((_, i) => i !== idx));
  }
  function moveProgramDay(idx: number, dir: -1 | 1) {
    setProgramRoutineIds((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return next;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function saveProgramFinal() {
    const name = programName.trim();
    if (!name) { alert('Give the program a name.'); return; }
    if (!programRoutineIds.length) { alert('Add at least one day.'); return; }
    saveProgram({ id: programEditId || uid(), name, routineIds: programRoutineIds, createdAt: Date.now() });
    refreshPrograms();
    setView('programs');
    say('Program saved.');
  }
  function removeProgram(id: string) {
    if (!confirm('Delete this program?')) return;
    deleteProgram(id);
    refreshPrograms();
  }
  function applyProgram(id: string) {
    setActiveProgram(id);
    refreshPrograms();
    say('Program activated — today\'s workout is ready.');
  }
  function stopProgram() {
    setActiveProgram(null);
    refreshPrograms();
  }
  async function shareProgram(p: WorkoutProgram) {
    const author = prompt('Post as (optional name):', getLS('communityAuthorName', ''));
    if (author === null) return;
    setLS('communityAuthorName', author);
    const ok = await postSharedProgram(p.name, author, programSnapshot(p));
    say(ok ? 'Shared to Community.' : "Couldn't share right now — check your connection.");
  }
  async function likeProgram(sp: SharedProgram) {
    if (likedIds.includes(sp.id)) return;
    const ok = await likeSharedProgram(sp.id);
    if (ok) {
      const nextLiked = [...likedIds, sp.id];
      setLikedIds(nextLiked);
      setLS('likedSharedPrograms', nextLiked);
      setShared((arr) => arr.map((x) => (x.id === sp.id ? { ...x, likes: x.likes + 1 } : x)).sort((a, b) => b.likes - a.likes));
    }
  }
  function useSharedProgram(sp: SharedProgram) {
    importSharedProgram(sp.name, sp.workouts);
    refresh();
    refreshPrograms();
    say(`"${sp.name}" added to your routines and programs.`);
  }
  function editRoutine(r: Routine) {
    setEditId(r.id);
    setBuild({ name: r.name, parts: routineParts(r).map(clonePart), editIdx: null });
    setView('assemble');
  }

  function pickType(t: PartType) {
    setBuild((b) => ({ ...b, editIdx: null }));
    if (t === 'timed') {
      setDraftTimed(build.editIdx != null && build.parts[build.editIdx]?.type === 'timed' ? (build.parts[build.editIdx] as { items: TimedItem[] }).items.map((x) => ({ ...x })) : [{ name: '', seconds: 45 }]);
      setView('edit-timed');
    } else if (t === 'rep') {
      setDraftRep([{ name: '', sets: 3, reps: null, rest: 60, note: '' }]);
      setView('edit-rep');
    } else {
      setDraftCircuit({ rounds: 3, work: 40, rest: 15, restRounds: 30, items: [{ name: '' }] });
      setView('edit-circuit');
    }
  }
  function backFromEditor() {
    setView(build.parts.length ? 'assemble' : 'list');
  }
  function savePart(part: RoutinePart) {
    setBuild((b) => {
      const parts = [...b.parts];
      if (b.editIdx != null && b.editIdx >= 0) parts[b.editIdx] = part;
      else parts.push(part);
      return { ...b, parts };
    });
    setView('assemble');
  }

  function saveTimedPart() {
    const items = draftTimed.filter((s) => s.name);
    if (!items.length) {
      alert('Add at least one step with a name.');
      return;
    }
    savePart({ kind: 'part', type: 'timed', items });
  }
  function saveRepPart() {
    const items = draftRep.filter((s) => s.name);
    if (!items.length) {
      alert('Add at least one exercise with a name.');
      return;
    }
    savePart({ kind: 'part', type: 'rep', items });
  }
  function saveCircuitPart() {
    const items = draftCircuit.items.filter((x) => x.name);
    if (!items.length) {
      alert('Add at least one move with a name.');
      return;
    }
    savePart({ kind: 'part', type: 'circuit', rounds: draftCircuit.rounds, work: draftCircuit.work, rest: draftCircuit.rest, restRounds: draftCircuit.restRounds, items });
  }

  function editExistingPart(i: number) {
    const p = build.parts[i];
    setBuild((b) => ({ ...b, editIdx: i }));
    if (p.type === 'rep') {
      setDraftRep(p.items.map((x) => ({ ...x })));
      setView('edit-rep');
    } else if (p.type === 'circuit') {
      setDraftCircuit({ rounds: p.rounds, work: p.work, rest: p.rest, restRounds: p.restRounds, items: p.items.map((x) => ({ ...x })) });
      setView('edit-circuit');
    } else {
      setDraftTimed(p.items.map((x) => ({ ...x })));
      setView('edit-timed');
    }
  }
  function deletePart(i: number) {
    setBuild((b) => ({ ...b, parts: b.parts.filter((_, idx) => idx !== i) }));
  }
  function movePart(i: number, d: number) {
    setBuild((b) => {
      const j = i + d;
      if (j < 0 || j >= b.parts.length) return b;
      const parts = [...b.parts];
      [parts[i], parts[j]] = [parts[j], parts[i]];
      return { ...b, parts };
    });
  }

  function saveRoutineFinal() {
    const name = build.name.trim();
    if (!name) {
      alert('Give the routine a name.');
      return;
    }
    if (!build.parts.length) {
      alert('Add at least one part.');
      return;
    }
    const steps = build.parts.map(clonePart);
    const arr = getRoutines();
    let saved: Routine;
    if (editId) {
      const i = arr.findIndex((x) => x.id === editId);
      if (i >= 0) {
        arr[i] = { ...arr[i], name, steps };
        saved = arr[i];
      } else {
        saved = { id: uid(), name, steps, createdAt: Date.now() };
        arr.push(saved);
      }
    } else {
      saved = { id: uid(), name, steps, createdAt: Date.now() };
      arr.push(saved);
    }
    setLS('workoutRoutines', arr);
    cloudSaveRoutine(saved);
    setView('list');
    setBuild(newBuild());
    refresh();
    say('Routine saved.');
  }
  function deleteRoutine() {
    if (!editId || !confirm('Delete this routine?')) return;
    const r = getRoutines().find((x) => x.id === editId);
    if (r) cloudDeleteRow('workout_routines', r);
    setLS('workoutRoutines', getRoutines().filter((x) => x.id !== editId));
    setView('list');
    setBuild(newBuild());
    refresh();
    say('Routine deleted.');
  }

  const inputCls = 'h-11 w-full rounded-xl border px-3 text-sm';
  const inputStyle = { borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' } as const;

  if (view === 'pick-part') {
    const first = !build.parts.length;
    return (
      <div>
        <button type="button" onClick={() => setView(first ? 'list' : 'assemble')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <h2 className="mb-1 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>{first ? 'New Routine' : 'Add a part'}</h2>
        <div className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>{first ? "What's the first part of this workout?" : 'What kind of part is this?'}</div>
        <div className="space-y-2.5">
          <button type="button" onClick={() => pickType('timed')} className="flex w-full items-center gap-3 rounded-[14px] border p-4 text-left" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <span className="text-2xl">⏱️</span>
            <span><span className="block font-bold" style={{ color: 'var(--foreground)' }}>Timed</span><span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Steps that each run for a set number of seconds and advance on their own, announced out loud.</span></span>
          </button>
          <button type="button" onClick={() => pickType('rep')} className="flex w-full items-center gap-3 rounded-[14px] border p-4 text-left" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <span className="text-2xl">🔁</span>
            <span><span className="block font-bold" style={{ color: 'var(--foreground)' }}>Rep</span><span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Log your sets at your own pace with a rest timer between each. Any order.</span></span>
          </button>
          <button type="button" onClick={() => pickType('circuit')} className="flex w-full items-center gap-3 rounded-[14px] border p-4 text-left" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <span className="text-2xl">🔄</span>
            <span><span className="block font-bold" style={{ color: 'var(--foreground)' }}>Circuit</span><span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>A set of moves repeated for several rounds — work, short rest, next move, on a timer.</span></span>
          </button>
        </div>
      </div>
    );
  }

  if (view === 'edit-timed') {
    const total = draftTimed.reduce((s, x) => s + (x.seconds || 0), 0);
    return (
      <div>
        <button type="button" onClick={backFromEditor} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-3 text-sm font-bold" style={{ color: 'var(--foreground)' }}>⏱️ Timed part</div>
          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Steps <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(name and seconds)</span></div>
          <div className="space-y-2">
            {draftTimed.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input value={s.name} onChange={(e) => setDraftTimed((d) => d.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Exercise or Rest" className={inputCls} style={inputStyle} />
                <input type="number" min={5} max={900} value={s.seconds} onChange={(e) => setDraftTimed((d) => d.map((x, idx) => idx === i ? { ...x, seconds: Math.max(5, parseInt(e.target.value, 10) || 45) } : x))} className="h-11 w-20 rounded-xl border px-2 text-sm" style={inputStyle} />
                <button type="button" onClick={() => setDraftTimed((d) => (d.length > 1 ? d.filter((_, idx) => idx !== i) : d))} className="text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraftTimed((d) => [...d, { name: '', seconds: 45 }])} className="mt-3 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Add Step</button>
          <div className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>Total: {fmtClock(total)}</div>
          <button type="button" onClick={saveTimedPart} className="mt-3 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save part</button>
        </div>
      </div>
    );
  }

  if (view === 'edit-rep') {
    return (
      <div>
        <button type="button" onClick={backFromEditor} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-3 text-sm font-bold" style={{ color: 'var(--foreground)' }}>🔁 Rep part</div>
          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Exercises <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(name, sets, reps, rest)</span></div>
          <div className="space-y-3">
            {draftRep.map((s, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 flex gap-2">
                  <input value={s.name} onChange={(e) => setDraftRep((d) => d.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Exercise" className={inputCls} style={inputStyle} />
                  <button type="button" disabled={i === 0} onClick={() => setDraftRep((d) => { const j = i - 1; const arr = [...d]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; })} className="rounded px-2 text-sm disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▲</button>
                  <button type="button" disabled={i === draftRep.length - 1} onClick={() => setDraftRep((d) => { const j = i + 1; const arr = [...d]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; })} className="rounded px-2 text-sm disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▼</button>
                  <button type="button" onClick={() => setDraftRep((d) => (d.length > 1 ? d.filter((_, idx) => idx !== i) : d))} className="text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
                </div>
                <div className="mb-2 grid grid-cols-3 gap-2">
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sets<input type="number" min={1} max={50} value={s.sets} onChange={(e) => setDraftRep((d) => d.map((x, idx) => idx === i ? { ...x, sets: Math.max(1, parseInt(e.target.value, 10) || 1) } : x))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Reps<input type="number" min={1} max={200} placeholder="—" value={s.reps ?? ''} onChange={(e) => setDraftRep((d) => d.map((x, idx) => idx === i ? { ...x, reps: e.target.value === '' ? null : parseInt(e.target.value, 10) } : x))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
                  <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Rest (sec)<input type="number" min={0} max={600} value={s.rest} onChange={(e) => setDraftRep((d) => d.map((x, idx) => idx === i ? { ...x, rest: Math.max(0, parseInt(e.target.value, 10) || 0) } : x))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
                </div>
                <input value={s.note || ''} onChange={(e) => setDraftRep((d) => d.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))} placeholder="Note (optional) — e.g. each side" className={inputCls} style={inputStyle} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraftRep((d) => [...d, { name: '', sets: 3, reps: null, rest: 60, note: '' }])} className="mt-3 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Add Exercise</button>
          <button type="button" onClick={saveRepPart} className="mt-4 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save part</button>
        </div>
      </div>
    );
  }

  if (view === 'edit-circuit') {
    const cc = draftCircuit;
    const preview = { kind: 'part' as const, type: 'circuit' as const, ...cc, items: cc.items.filter((x) => x.name) };
    return (
      <div>
        <button type="button" onClick={backFromEditor} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-3 text-sm font-bold" style={{ color: 'var(--foreground)' }}>🔄 Circuit part</div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Rounds<input type="number" min={1} max={20} value={cc.rounds} onChange={(e) => setDraftCircuit((d) => ({ ...d, rounds: Math.max(1, parseInt(e.target.value, 10) || 1) }))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Work (sec)<input type="number" min={5} max={600} value={cc.work} onChange={(e) => setDraftCircuit((d) => ({ ...d, work: Math.max(5, parseInt(e.target.value, 10) || 40) }))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Rest (sec)<input type="number" min={0} max={300} value={cc.rest} onChange={(e) => setDraftCircuit((d) => ({ ...d, rest: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
            <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Round rest<input type="number" min={0} max={600} value={cc.restRounds} onChange={(e) => setDraftCircuit((d) => ({ ...d, restRounds: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className={inputCls + ' mt-1'} style={inputStyle} /></label>
          </div>
          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Moves <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(each runs for the work time)</span></div>
          <div className="space-y-2">
            {cc.items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <input value={it.name} onChange={(e) => setDraftCircuit((d) => ({ ...d, items: d.items.map((x, idx) => idx === i ? { name: e.target.value } : x) }))} placeholder="Exercise" className={inputCls} style={inputStyle} />
                <button type="button" onClick={() => setDraftCircuit((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((_, idx) => idx !== i) : d.items }))} className="text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraftCircuit((d) => ({ ...d, items: [...d.items, { name: '' }] }))} className="mt-3 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Add Move</button>
          <div className="mt-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>About {fmtClock(partTotalSec(preview))}</div>
          <button type="button" onClick={saveCircuitPart} className="mt-3 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save part</button>
        </div>
      </div>
    );
  }

  if (view === 'assemble') {
    return (
      <div>
        <button type="button" onClick={() => { setView('list'); setBuild(newBuild()); }} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Routine name</label>
          <input value={build.name} onChange={(e) => setBuild((b) => ({ ...b, name: e.target.value }))} placeholder="e.g. Full Body" className={inputCls + ' mb-4'} style={inputStyle} />
          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Parts of your workout</div>
          {!build.parts.length && <div className="my-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>No parts yet.</div>}
          <div className="space-y-2">
            {build.parts.map((p, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm"><b style={{ color: 'var(--foreground)' }}>Part {i + 1}</b> <span style={{ color: 'var(--muted-foreground)' }}>{partSummary(p)}</span></span>
                </div>
                <div className="flex gap-2 text-sm">
                  <button type="button" disabled={i === 0} onClick={() => movePart(i, -1)} className="rounded px-2 disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▲</button>
                  <button type="button" disabled={i === build.parts.length - 1} onClick={() => movePart(i, 1)} className="rounded px-2 disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▼</button>
                  <button type="button" onClick={() => editExistingPart(i)} className="rounded px-2" style={{ color: 'var(--primary)' }}>✎ Edit</button>
                  <button type="button" onClick={() => deletePart(i)} className="rounded px-2" style={{ color: 'var(--destructive)' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setView('pick-part')} className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Add another part</button>
          <div className="mt-4 flex gap-2">
            {editId && <button type="button" onClick={deleteRoutine} className="flex-1 rounded-xl py-3 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Delete</button>}
            <button type="button" onClick={saveRoutineFinal} className="flex-1 rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save Routine</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'programs') {
    return (
      <div>
        <button type="button" onClick={() => setView('list')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>📆 Programs</h2>
        {flash && <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>{flash}</div>}
        <button type="button" onClick={startNewProgram} className="mb-2.5 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--navy)' }}>＋ New Program</button>
        <button type="button" onClick={() => setView('community')} className="mb-4 w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>🌐 Browse Community Programs</button>
        {!programs.length ? (
          <div className="rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Bundle a week or month of routines into one program you can apply all at once.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {programs.map((p) => {
              const isActive = activeProgram?.programId === p.id;
              return (
                <div key={p.id} className="rounded-[14px] border p-3.5" style={{ borderColor: isActive ? 'var(--primary)' : 'var(--border)', background: 'var(--card)' }}>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold" style={{ color: 'var(--foreground)' }}>{p.name}</span>
                    {isActive && <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--primary)' }}>ACTIVE</span>}
                  </div>
                  <div className="mb-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{p.routineIds.length} day{p.routineIds.length === 1 ? '' : 's'}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => editProgram(p)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Edit</button>
                    <button type="button" onClick={() => shareProgram(p)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>🌐 Share</button>
                    {isActive ? (
                      <button type="button" onClick={stopProgram} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Stop</button>
                    ) : (
                      <button type="button" onClick={() => applyProgram(p.id)} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Apply Program</button>
                    )}
                    <button type="button" onClick={() => removeProgram(p.id)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--destructive)' }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (view === 'community') {
    return (
      <div>
        <button type="button" onClick={() => setView('programs')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <h2 className="mb-1 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>🌐 Community</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Programs other missionaries have shared. No chat — just browse, like, and use.</p>
        {flash && <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>{flash}</div>}
        {sharedLoading ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
        ) : !shared.length ? (
          <div className="rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Nothing shared yet — be the first from the Programs page.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shared.map((sp) => {
              const dayCount = Array.isArray(sp.workouts) ? sp.workouts.length : 0;
              return (
              <div key={sp.id} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <div className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>{sp.name}</div>
                <div className="mb-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {dayCount} day{dayCount === 1 ? '' : 's'}{sp.author ? ` · by ${sp.author}` : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => likeProgram(sp)}
                    disabled={likedIds.includes(sp.id)}
                    className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-60"
                    style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
                  >
                    {likedIds.includes(sp.id) ? '❤️' : '🤍'} {sp.likes}
                  </button>
                  <button type="button" onClick={() => useSharedProgram(sp)} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Use This Program</button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (view === 'program-edit') {
    return (
      <div>
        <button type="button" onClick={() => setView('programs')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back</button>
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Program name</label>
          <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="e.g. 4-Week Strength Build" className={inputCls + ' mb-4'} style={inputStyle} />

          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Days, in order</div>
          {!programRoutineIds.length && <div className="my-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>No days yet — add routines below.</div>}
          <div className="mb-3 space-y-2">
            {programRoutineIds.map((rid, i) => {
              const r = routines.find((x) => x.id === rid);
              return (
                <div key={i} className="flex items-center justify-between rounded-xl border p-2.5" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>Day {i + 1}: <b>{r ? r.name : '(deleted routine)'}</b></span>
                  <div className="flex gap-1 text-sm">
                    <button type="button" disabled={i === 0} onClick={() => moveProgramDay(i, -1)} className="rounded px-2 disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▲</button>
                    <button type="button" disabled={i === programRoutineIds.length - 1} onClick={() => moveProgramDay(i, 1)} className="rounded px-2 disabled:opacity-30" style={{ color: 'var(--muted-foreground)' }}>▼</button>
                    <button type="button" onClick={() => removeProgramDay(i)} className="rounded px-2" style={{ color: 'var(--destructive)' }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mb-1 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Add a routine as the next day</div>
          {!routines.length ? (
            <div className="my-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Build a routine first, then come back here.</div>
          ) : (
            <div className="mb-4 flex flex-wrap gap-2">
              {routines.map((r) => (
                <button key={r.id} type="button" onClick={() => addRoutineToProgram(r.id)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ {r.name}</button>
              ))}
            </div>
          )}

          <button type="button" onClick={saveProgramFinal} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save Program</button>
        </div>
      </div>
    );
  }

  const todaySlot = todaysProgramSlot();

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>📋 Routines</h2>
      <button type="button" onClick={() => setView('programs')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>📆 Programs {activeProgram && '· 1 active'}</button>
      {todaySlot && !todaySlot.complete && todaySlot.routine && (
        <div className="mb-3 rounded-[14px] border p-3.5" style={{ borderColor: 'var(--primary)', background: 'var(--card)' }}>
          <div className="mb-1 text-xs font-bold uppercase" style={{ color: 'var(--gold-dark)' }}>{todaySlot.program.name} · Day {todaySlot.dayIndex + 1}</div>
          <div className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Today: {todaySlot.routine.name}</div>
          <button type="button" onClick={() => navigate(`/exercise/workout?start=${todaySlot.routine!.id}`)} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>▶ Start Today's Workout</button>
        </div>
      )}
      {todaySlot?.complete && (
        <div className="mb-3 rounded-[14px] border p-3.5 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>
          🎉 You finished "{todaySlot.program.name}"! Apply it again or start a new program from the Programs page.
        </div>
      )}
      {flash && <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>{flash}</div>}
      <button type="button" onClick={startNew} className="mb-4 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--navy)' }}>＋ New Routine</button>

      <div className="mb-4">
        <h3 className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Built-in Workouts</h3>
        <p className="mb-2.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>Use one as a starting point — it's copied into your routines so you can edit it freely.</p>
        <div className="space-y-2">
          {BUILT_IN_WORKOUTS.map((t) => (
            <div key={t.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="mb-0.5 text-sm font-bold" style={{ color: 'var(--foreground)' }}>{t.name}</div>
              <div className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.description}</div>
              <button type="button" onClick={() => useTemplate(t)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Use as Template</button>
            </div>
          ))}
        </div>
      </div>

      {!routines.length ? (
        <div className="mb-4 rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-2 text-3xl">📋</div>
          <h3 className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>No routines yet</h3>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>Build one, or start from a sample you can edit however you like.</p>
          <button type="button" onClick={addSample} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Add a sample routine</button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {routines.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((r) => {
            const bd = routineBadge(r);
            const cls = badgeClass(bd);
            return (
              <div key={r.id} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-bold" style={{ color: 'var(--foreground)' }}>{r.name}</span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: badgeColor[cls] }}>{bd}</span>
                </div>
                <div className="mb-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>{routineMeta(r)}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => editRoutine(r)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Edit</button>
                  <button type="button" onClick={() => navigate(`/exercise/workout?start=${r.id}`)} className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>▶ Start</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
