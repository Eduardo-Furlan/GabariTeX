import { useLayoutEffect, useEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const isReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(target);
  const first = useRef(true);
  const current = useRef(target);

  useIsoLayoutEffect(() => {
    if (isReducedMotion()) {
      current.current = target;
      first.current = false;
      setValue(target);
      return;
    }

    const from = first.current ? 0 : current.current;
    const dur = duration;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
      current.current = v;
      setValue(p < 1 ? v : target);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    setValue(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
