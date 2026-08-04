let availableVoices: SpeechSynthesisVoice[] = [];

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const load = () => {
    availableVoices = window.speechSynthesis.getVoices();
  };
  load();
  window.speechSynthesis.onvoiceschanged = load;
}

/* names that signal a higher-quality voice, checked in order */
const VOICE_QUALITY_HINTS = ['enhanced', 'premium', 'natural', 'neural', 'siri'];
const VOICE_KNOWN_GOOD = [
  'Samantha', 'Ava', 'Allison', 'Alex', 'Serena', 'Karen', 'Moira', 'Daniel',
  'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy', 'Microsoft Michelle',
  'Google US English', 'Google UK English Female', 'Google UK English Male',
];

function englishVoices(): SpeechSynthesisVoice[] {
  return availableVoices.filter((v) => (v.lang || '').toLowerCase().startsWith('en'));
}
function pickBestVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!list || !list.length) return null;
  const byHint = list.find((v) => VOICE_QUALITY_HINTS.some((h) => (v.name || '').toLowerCase().includes(h)));
  if (byHint) return byHint;
  for (const good of VOICE_KNOWN_GOOD) {
    const m = list.find((v) => (v.name || '').toLowerCase().includes(good.toLowerCase()));
    if (m) return m;
  }
  return list.find((v) => v.default) || list[0];
}
/* saved choice (set in Settings, not yet ported), else best guess */
function currentVoice(): SpeechSynthesisVoice | null {
  const list = englishVoices();
  if (!list.length) return null;
  const want = localStorage.getItem('preferredVoiceName');
  return list.find((v) => v.name === want) || pickBestVoice(list);
}

interface SpeakOpts {
  onEnd?: () => void;
  rate?: number;
  pitch?: number;
}

function speakWith(voice: SpeechSynthesisVoice | null, text: string, opts?: SpeakOpts): boolean {
  const done = opts?.onEnd;
  if (!('speechSynthesis' in window) || !text) {
    if (done) done();
    return false;
  }
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = opts?.rate || 1;
    u.pitch = opts?.pitch || 1;
    if (done) {
      let fired = false;
      const fire = () => {
        if (!fired) {
          fired = true;
          done();
        }
      };
      u.onend = fire;
      u.onerror = fire;
      // safety net: some browsers never fire onend, which would stall the lead-in
      setTimeout(fire, Math.min(12000, 1400 + text.length * 80));
    }
    window.speechSynthesis.cancel(); // don't queue on top of a previous line
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    if (done) done();
    return false;
  }
}

/* short tone for the get-ready countdown - generated, no audio files */
let _audioCtx: AudioContext | null = null;
export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    _audioCtx = _audioCtx || new AC();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
  } catch {
    /* ignore */
  }
}
export function beep(freq?: number, ms?: number, vol?: number) {
  try {
    primeAudio();
    if (!_audioCtx) return;
    const dur = (ms || 160) / 1000;
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq || 660;
    const t0 = _audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(_audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  } catch {
    /* ignore */
  }
}
/* PUBLIC: spoken announcements call this. */
export function speak(text: string, opts?: SpeakOpts): boolean {
  return speakWith(currentVoice(), text, opts);
}
export function cancelSpeech() {
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}
