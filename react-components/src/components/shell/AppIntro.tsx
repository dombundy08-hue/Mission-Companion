import { useEffect, useRef } from 'react';

// Netflix-style brand intro — plays once every time the app is opened,
// distinct from KineticLoader (which is the functional "something is
// loading" indicator, now also used for the real cloud-sync wait — see
// App.tsx's useCloudSynced). Purely decorative: doesn't wait on fonts/data,
// just plays and hands off.
const LINE_1 = 'MISSIONARY';
const LINE_2 = 'COMPANION';
const HOLD_MS = 2000;
const TOTAL_MS = 2700;

function flyInWord(el: HTMLDivElement, word: string, baseDelay: number): HTMLSpanElement[] {
  el.innerHTML = '';
  return word.split('').map((char, index) => {
    const span = document.createElement('span');
    span.className = 'kinetic-char';
    span.textContent = char;
    const fromX = (Math.random() - 0.5) * 800;
    const fromY = (Math.random() - 0.5) * 800;
    const fromZ = (Math.random() - 0.5) * 800;
    const fromRotX = (Math.random() - 0.5) * 360;
    const fromRotY = (Math.random() - 0.5) * 360;
    span.style.setProperty('--transform-from', `translate3d(${fromX}px, ${fromY}px, ${fromZ}px) rotateX(${fromRotX}deg) rotateY(${fromRotY}deg)`);
    span.style.animationName = 'kinetic-fly-in';
    span.style.animationDelay = `${baseDelay + index * 0.04}s`;
    el.appendChild(span);
    return span;
  });
}

export function AppIntro({ onDone }: { onDone: () => void }) {
  const line1Ref = useRef<HTMLDivElement>(null);
  const line2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el1 = line1Ref.current;
    const el2 = line2Ref.current;
    if (!el1 || !el2) return;

    const chars = [...flyInWord(el1, LINE_1, 0), ...flyInWord(el2, LINE_2, 0.32)];

    const flyOutTimeout = setTimeout(() => {
      chars.forEach((span, index) => {
        const toX = (Math.random() - 0.5) * 800;
        const toY = (Math.random() - 0.5) * 800;
        const toZ = (Math.random() - 0.5) * 800;
        const toRotX = (Math.random() - 0.5) * 360;
        const toRotY = (Math.random() - 0.5) * 360;
        span.style.setProperty('--transform-to', `translate3d(${toX}px, ${toY}px, ${toZ}px) rotateX(${toRotX}deg) rotateY(${toRotY}deg)`);
        span.style.animationName = 'kinetic-fly-out';
        span.style.animationDelay = `${(chars.length - index) * 0.03}s`;
      });
    }, HOLD_MS);

    const doneTimeout = setTimeout(onDone, TOTAL_MS);

    return () => {
      clearTimeout(flyOutTimeout);
      clearTimeout(doneTimeout);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-1"
      style={{ background: 'var(--navy)' }}
      role="presentation"
    >
      <div ref={line1Ref} className="whitespace-nowrap text-3xl font-extrabold tracking-wide text-white sm:text-5xl" style={{ perspective: '1000px' }} />
      <div ref={line2Ref} className="whitespace-nowrap text-3xl font-extrabold tracking-wide sm:text-5xl" style={{ perspective: '1000px', color: 'var(--gold)' }} />
    </div>
  );
}
