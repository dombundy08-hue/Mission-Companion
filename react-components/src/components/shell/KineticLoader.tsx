import { useEffect, useRef } from 'react';

const WORDS = ['LOADING', 'MISSIONARY', 'COMPANION'];

export function KineticLoader() {
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    let wordIndex = 0;
    let flyOutTimeout: ReturnType<typeof setTimeout>;
    let nextWordTimeout: ReturnType<typeof setTimeout>;

    function animateWord() {
      if (!el) return;
      const word = WORDS[wordIndex];
      el.innerHTML = '';

      const chars = word.split('').map((char, index) => {
        const span = document.createElement('span');
        span.className = 'kinetic-char';
        span.textContent = char;

        const fromX = (Math.random() - 0.5) * 800;
        const fromY = (Math.random() - 0.5) * 800;
        const fromZ = (Math.random() - 0.5) * 800;
        const fromRotX = (Math.random() - 0.5) * 360;
        const fromRotY = (Math.random() - 0.5) * 360;
        span.style.setProperty(
          '--transform-from',
          `translate3d(${fromX}px, ${fromY}px, ${fromZ}px) rotateX(${fromRotX}deg) rotateY(${fromRotY}deg)`
        );
        span.style.animationName = 'kinetic-fly-in';
        span.style.animationDelay = `${index * 0.05}s`;

        el.appendChild(span);
        return span;
      });

      flyOutTimeout = setTimeout(() => {
        chars.forEach((span, index) => {
          const toX = (Math.random() - 0.5) * 800;
          const toY = (Math.random() - 0.5) * 800;
          const toZ = (Math.random() - 0.5) * 800;
          const toRotX = (Math.random() - 0.5) * 360;
          const toRotY = (Math.random() - 0.5) * 360;
          span.style.setProperty(
            '--transform-to',
            `translate3d(${toX}px, ${toY}px, ${toZ}px) rotateX(${toRotX}deg) rotateY(${toRotY}deg)`
          );
          span.style.animationName = 'kinetic-fly-out';
          span.style.animationDelay = `${(chars.length - index) * 0.05}s`;
        });
      }, 900);

      nextWordTimeout = setTimeout(() => {
        wordIndex = (wordIndex + 1) % WORDS.length;
        animateWord();
      }, 1300);
    }

    animateWord();

    return () => {
      clearTimeout(flyOutTimeout);
      clearTimeout(nextWordTimeout);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={{ background: 'var(--navy)' }}
      role="status"
      aria-label="Loading Mission Companion"
    >
      <h1
        ref={textRef}
        className="whitespace-nowrap text-4xl font-extrabold text-white sm:text-6xl"
        style={{ perspective: '1000px' }}
      />
    </div>
  );
}
