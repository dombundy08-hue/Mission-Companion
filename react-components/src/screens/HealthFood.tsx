import { useState } from 'react';
import {
  isoDate,
  isFastSunday,
  toggleFastSunday,
  usdaSearch,
  offSearch,
  getSavedFoods,
  addSavedFood,
  deleteSavedFood,
  logSavedFood,
  countIdenticalFoodInWindow,
  type FoodResult,
  type SavedFood,
} from '@/lib/health-data';
import { getLS, setLS, uid } from '@/lib/storage';
import { cloudSaveHealth, cloudDeleteRow } from '@/lib/supabase-sync';
import { callClaude } from '@/lib/claude-api';

interface FoodEntry {
  id: string;
  cloudId?: string;
  entryDate: string;
  timestamp: number;
  description: string;
  calories: number;
  protein: number | null;
  grams?: number;
  source?: string;
  [key: string]: unknown;
}

type Mode = 'search' | 'estimate';

export function HealthFood() {
  const today = isoDate();
  const [mode, setMode] = useState<Mode>('search');
  const [entries, setEntries] = useState<FoodEntry[]>(() =>
    getLS<FoodEntry[]>('healthFood', []).filter((e) => e.entryDate === today).sort((a, b) => b.timestamp - a.timestamp)
  );
  const hasUsda = !!localStorage.getItem('usdaApiKey');
  const [isFast, setIsFast] = useState(() => isFastSunday(today));
  const [lastLogged, setLastLogged] = useState<{ name: string; calories: number | null; protein: number | null } | null>(null);

  // search mode state
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [results, setResults] = useState<FoodResult[] | null>(null);
  const [pick, setPick] = useState<FoodResult | null>(null);
  const [grams, setGrams] = useState('');
  const [pickCal, setPickCal] = useState('');
  const [pickProt, setPickProt] = useState('');

  // estimate mode state
  const [estText, setEstText] = useState('');
  const [estPhase, setEstPhase] = useState<'input' | 'confirm'>('input');
  const [estBusy, setEstBusy] = useState(false);
  const [estErr, setEstErr] = useState(false);
  const [estCal, setEstCal] = useState('');
  const [estProt, setEstProt] = useState('');

  // saved foods state
  const [saved, setSaved] = useState<SavedFood[]>(() => getSavedFoods().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  const [savedAdding, setSavedAdding] = useState(false);
  const [sfName, setSfName] = useState('');
  const [sfCal, setSfCal] = useState('');
  const [sfProt, setSfProt] = useState('');

  const total = entries.reduce((s, e) => s + (e.calories || 0), 0);
  const totalProt = entries.reduce((s, e) => s + (e.protein || 0), 0);

  function refreshEntries() {
    setEntries(getLS<FoodEntry[]>('healthFood', []).filter((e) => e.entryDate === today).sort((a, b) => b.timestamp - a.timestamp));
  }

  function logRow(row: FoodEntry) {
    const arr = getLS<FoodEntry[]>('healthFood', []);
    arr.push(row);
    setLS('healthFood', arr);
    cloudSaveHealth('healthFood', row);
    refreshEntries();
    setLastLogged({ name: row.description, calories: row.calories, protein: row.protein });
  }

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr('');
    setResults(null);
    const out: FoodResult[] = [];
    let usdaRejected = false, anyFail = false, ran = 0;
    if (hasUsda) {
      ran++;
      try {
        (await usdaSearch(q)).forEach((f) => out.push({ ...f, source: 'usda' }));
      } catch (e) {
        anyFail = true;
        if (/\b40[13]\b/.test(String((e as Error)?.message || e))) usdaRejected = true;
      }
    }
    ran++;
    try {
      (await offSearch(q)).forEach((f) => out.push(f));
    } catch {
      anyFail = true;
    }
    setResults(out);
    if (!out.length) {
      if (ran === 0) setSearchErr('Add a USDA key in Settings.');
      else if (usdaRejected) setSearchErr('USDA key was rejected — check it in Settings.');
      else if (anyFail) setSearchErr('Search failed. Check your connection and try again.');
    }
    setSearching(false);
  }

  function selectResult(f: FoodResult) {
    setPick(f);
    const g = f.servingSize ? String(f.servingSize) : '';
    setGrams(g);
    const gramsNum = f.servingSize || 100;
    setPickCal(String(Math.round((f.kcal100 || 0) * gramsNum / 100)));
    setPickProt(String(Math.round((f.prot100 || 0) * gramsNum / 100)));
  }

  function onGramsChange(v: string) {
    setGrams(v);
    if (!pick) return;
    const g = parseFloat(v) || 0;
    setPickCal(String(Math.round((pick.kcal100 || 0) * g / 100)));
    setPickProt(String(Math.round((pick.prot100 || 0) * g / 100)));
  }

  function saveFromDb() {
    if (!pick) return;
    const g = parseFloat(grams);
    const cal = parseInt(pickCal, 10);
    const prot = parseInt(pickProt, 10);
    if (isNaN(g) || g <= 0) {
      alert('Enter the amount in grams.');
      return;
    }
    if (isNaN(cal)) {
      alert('Calories are missing.');
      return;
    }
    logRow({ id: uid(), entryDate: today, timestamp: Date.now(), description: pick.name, grams: g, calories: cal, protein: isNaN(prot) ? null : prot, source: 'database' });
    setPick(null);
    setGrams('');
    setResults(null);
    setQuery('');
  }

  async function estimate() {
    const desc = estText.trim();
    if (!desc) {
      alert('Describe what you ate first.');
      return;
    }
    setEstBusy(true);
    setEstErr(false);
    let cal: number | null = null, prot: number | null = null, err = false;
    try {
      const sys =
        'You are a careful, knowledgeable nutrition-estimation assistant. From a short meal description, reason about the likely portion size, preparation method, and typical ingredients, then estimate the total calories and total protein in grams for the whole meal described. Account for cooking oils and sauces implied by the preparation. Respond with ONLY a compact JSON object and nothing else, in the form {"calories": <integer>, "protein": <integer grams>}.';
      const txt = await callClaude(sys, [{ role: 'user', content: desc }], 60);
      let obj: { calories?: number; protein?: number } | null = null;
      const jm = (txt || '').match(/\{[\s\S]*\}/);
      if (jm) {
        try {
          obj = JSON.parse(jm[0]);
        } catch {
          /* fall through to number extraction */
        }
      }
      if (obj && obj.calories != null) {
        cal = obj.calories;
        prot = obj.protein != null ? obj.protein : null;
      } else {
        const nums = (txt || '').match(/\d{1,5}/g);
        if (nums && nums.length) {
          cal = parseInt(nums[0], 10);
          if (nums[1]) prot = parseInt(nums[1], 10);
        } else err = true;
      }
      if (cal != null && isNaN(cal)) {
        cal = null;
        err = true;
      }
    } catch {
      err = true;
    }
    setEstBusy(false);
    setEstErr(err);
    setEstCal(cal == null ? '' : String(cal));
    setEstProt(prot == null ? '' : String(prot));
    setEstPhase('confirm');
  }

  function saveEstimate() {
    const desc = estText.trim();
    const cal = parseInt(estCal, 10);
    const prot = estProt === '' ? null : parseInt(estProt, 10);
    if (!desc) {
      alert('Describe what you ate.');
      return;
    }
    if (isNaN(cal)) {
      alert('Enter a calorie number.');
      return;
    }
    logRow({ id: uid(), entryDate: today, timestamp: Date.now(), description: desc, calories: cal, protein: prot == null || isNaN(prot) ? null : prot, source: 'estimate' });
    setEstText('');
    setEstCal('');
    setEstProt('');
    setEstPhase('input');
    setEstErr(false);
  }

  function deleteEntry(id: string) {
    const e = getLS<FoodEntry[]>('healthFood', []).find((x) => x.id === id);
    if (e) cloudDeleteRow('health_food_log', e);
    setLS('healthFood', getLS<FoodEntry[]>('healthFood', []).filter((x) => x.id !== id));
    refreshEntries();
  }

  function logSaved(sf: SavedFood) {
    logSavedFood(sf);
    refreshEntries();
  }
  function deleteSaved(id: string) {
    if (!confirm('Delete this saved food?')) return;
    deleteSavedFood(id);
    setSaved(getSavedFoods().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  }
  function saveNewSavedFood() {
    const name = sfName.trim();
    if (!name) {
      alert('Enter a food name.');
      return;
    }
    if (sfCal === '' || isNaN(parseInt(sfCal, 10))) {
      alert('Enter the calories.');
      return;
    }
    addSavedFood(name, sfCal, sfProt);
    setSaved(getSavedFoods().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    setSfName('');
    setSfCal('');
    setSfProt('');
    setSavedAdding(false);
  }
  function saveLastLoggedAsSaved() {
    if (!lastLogged) return;
    addSavedFood(lastLogged.name, lastLogged.calories ?? 0, lastLogged.protein ?? '');
    setSaved(getSavedFoods().slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    setLastLogged(null);
  }

  const showSaveThis = lastLogged && countIdenticalFoodInWindow(lastLogged.name, lastLogged.calories, lastLogged.protein, 90) >= 10;

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>🍽️ Food</h2>
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setMode('search')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: mode === 'search' ? 'var(--navy)' : 'var(--card)', color: mode === 'search' ? 'white' : 'var(--navy)' }}>🔍 Search Food</button>
        <button type="button" onClick={() => setMode('estimate')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: mode === 'estimate' ? 'var(--navy)' : 'var(--card)', color: mode === 'estimate' ? 'white' : 'var(--navy)' }}>✏️ Rough Estimate</button>
      </div>

      {showSaveThis && lastLogged && (
        <div className="mb-4 flex items-center justify-between rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>Logged <b>{lastLogged.name}</b>{lastLogged.calories != null ? ` · ${lastLogged.calories} cal` : ''}</span>
          <button type="button" onClick={saveLastLoggedAsSaved} className="rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>☆ Save this</button>
        </div>
      )}

      {mode === 'search' ? (
        !hasUsda ? (
          <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>Food search uses the free USDA database and Open Food Facts. Add your USDA key in Settings (⚙️).</div>
            <div className="mt-2.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>Or use "Rough Estimate" above for a quick AI guess.</div>
          </div>
        ) : pick ? (
          <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <button type="button" onClick={() => setPick(null)} className="mb-2 text-sm font-medium" style={{ color: 'var(--primary)' }}>← Back to results</button>
            <div className="mb-1 text-base font-bold" style={{ color: 'var(--navy)' }}>{pick.name}</div>
            <div className="mb-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>{Math.round(pick.kcal100 || 0)} cal · {Math.round(pick.prot100 || 0)}g protein per 100g</div>
            {pick.servingSize && (
              <button type="button" onClick={() => onGramsChange(String(pick.servingSize))} className="mb-3 rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
                1 serving ({Math.round(pick.servingSize)}g){pick.servingText ? ` · ${pick.servingText}` : ''}
              </button>
            )}
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Amount (grams)</label>
            <input type="number" min={1} max={4000} placeholder="e.g. 140" value={grams} onChange={(e) => onGramsChange(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
            <div className="mb-1 flex gap-2">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Calories</label><input type="number" value={pickCal} onChange={(e) => setPickCal(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Protein (g)</label><input type="number" value={pickProt} onChange={(e) => setPickProt(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
            </div>
            <div className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>Scaled from the database — edit if needed.</div>
            <button type="button" onClick={saveFromDb} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>Save</button>
          </div>
        ) : (
          <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Search foods</label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
                placeholder="e.g. chicken breast"
                className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
              />
              <button type="button" onClick={doSearch} className="min-w-[92px] rounded-xl px-3 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>{searching ? '…' : 'Search'}</button>
            </div>
            {searchErr && <div className="mt-2.5 text-sm" style={{ color: 'var(--destructive)' }}>{searchErr}</div>}
            {results && (
              results.length === 0 && !searchErr ? (
                <div className="mt-2.5 text-sm" style={{ color: 'var(--muted-foreground)' }}>No results with full calorie &amp; protein data — try a simpler term.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {results.map((f, i) => (
                    <button key={i} type="button" onClick={() => selectResult(f)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{f.name} {f.source === 'off' ? <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--secondary)' }}>Brand</span> : <span className="ml-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--secondary)' }}>USDA</span>}</span>
                      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{Math.round(f.kcal100 || 0)} cal · {Math.round(f.prot100 || 0)}g /100g</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )
      ) : (
        <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>A quick AI guess for foods that aren't in the database. Less precise — these save marked "~ est."</div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>What did you eat?</label>
          <textarea value={estText} onChange={(e) => setEstText(e.target.value)} placeholder="e.g. chicken and rice, big plate" className="min-h-[100px] w-full rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
          {estPhase === 'confirm' ? (
            <div>
              {estErr && <div className="mt-2.5 text-sm" style={{ color: 'var(--destructive)' }}>Couldn't estimate automatically — enter the numbers yourself.</div>}
              <div className="mt-3 flex gap-2">
                <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Calories</label><input type="number" min={0} max={5000} value={estCal} onChange={(e) => setEstCal(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
                <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Protein (g)</label><input type="number" min={0} max={300} value={estProt} onChange={(e) => setEstProt(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => { setEstPhase('input'); setEstCal(''); setEstProt(''); setEstErr(false); }} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Cancel</button>
                <button type="button" onClick={saveEstimate} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Save estimate</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={estimate} disabled={estBusy} className="mt-3 w-full rounded-xl py-3 text-[17px] font-bold text-white disabled:opacity-60" style={{ background: 'var(--primary)' }}>{estBusy ? 'Estimating…' : 'Estimate Calories & Protein'}</button>
          )}
        </div>
      )}

      <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-2 text-sm font-bold" style={{ color: 'var(--navy)' }}>Today · {total} cal · {Math.round(totalProt)}g protein</div>
        <button
          type="button"
          onClick={() => { toggleFastSunday(today); setIsFast(isFastSunday(today)); }}
          className="mb-3 text-sm"
          style={{ color: isFast ? 'var(--navy)' : 'var(--muted-foreground)' }}
        >
          ⊙ Fasting today {isFast && <span className="text-xs">— excluded from avg</span>}
        </button>
        {entries.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Nothing logged yet today.</div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: 'var(--secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                  {e.description}
                  {e.grams ? <span className="ml-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>{Math.round(e.grams)}g</span> : null}
                  {e.source === 'estimate' ? <span className="ml-1 text-xs" style={{ color: 'var(--gold-dark)' }}>~ est.</span> : null}
                </span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{e.calories || 0} cal{e.protein != null ? ` · ${Math.round(e.protein)}g` : ''}</span>
                <button type="button" onClick={() => deleteEntry(e.id)} className="ml-2 text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-2 text-sm font-bold" style={{ color: 'var(--navy)' }}>☆ Saved Foods</div>
        {saved.length === 0 && !savedAdding && <div className="mb-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>No saved foods yet. Save the ones you eat often for one-tap logging.</div>}
        <div className="space-y-1.5">
          {saved.map((sf) => (
            <div key={sf.id} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: 'var(--secondary)' }}>
              <button type="button" onClick={() => logSaved(sf)} className="flex flex-1 items-center justify-between text-left">
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>{sf.name}</span>
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{sf.calories || 0} cal{sf.protein != null ? ` · ${Math.round(sf.protein)}g` : ''}</span>
              </button>
              <button type="button" onClick={() => deleteSaved(sf.id)} className="ml-2 text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
            </div>
          ))}
        </div>
        {savedAdding ? (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Food name</label>
            <input value={sfName} onChange={(e) => setSfName(e.target.value)} placeholder="e.g. Protein shake" className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
            <div className="mb-3 flex gap-2">
              <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Calories</label><input type="number" min={0} max={5000} value={sfCal} onChange={(e) => setSfCal(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
              <div className="flex-1"><label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Protein (g)</label><input type="number" min={0} max={300} value={sfProt} onChange={(e) => setSfProt(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} /></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSavedAdding(false)} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Cancel</button>
              <button type="button" onClick={saveNewSavedFood} className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Save Food</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setSavedAdding(true)} className="mt-3 w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Add Saved Food</button>
        )}
      </div>
    </div>
  );
}

