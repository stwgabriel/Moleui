'use client';

import { useEffect, useRef } from 'react';

export default function Page() {
  const stageRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let frame = 0;
    let x = 50;
    let y = 42;

    const updatePointer = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      x = ((event.clientX - rect.left) / rect.width) * 100;
      y = ((event.clientY - rect.top) / rect.height) * 100;

      if (frame) return;
      frame = requestAnimationFrame(() => {
        stage.style.setProperty('--pointer-x', `${x.toFixed(2)}%`);
        stage.style.setProperty('--pointer-y', `${y.toFixed(2)}%`);
        frame = 0;
      });
    };

    stage.addEventListener('pointermove', updatePointer, { passive: true });

    return () => {
      stage.removeEventListener('pointermove', updatePointer);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main ref={stageRef} className="background-stage" aria-label="Animated Moleui background">
      <div className="background-grid" aria-hidden="true" />
      <div className="pointer-glow" aria-hidden="true" />
      <div className="aurora aurora-one" aria-hidden="true" />
      <div className="aurora aurora-two" aria-hidden="true" />
      <div className="aurora aurora-three" aria-hidden="true" />
      <div className="aurora aurora-four" aria-hidden="true" />
      <div className="glass-pane glass-pane-one" aria-hidden="true" />
      <div className="glass-pane glass-pane-two" aria-hidden="true" />
      <div className="glass-pane glass-pane-three" aria-hidden="true" />
      <div className="glass-orb glass-orb-one" aria-hidden="true" />
      <div className="glass-orb glass-orb-two" aria-hidden="true" />
      <div className="glass-orb glass-orb-three" aria-hidden="true" />
      <div className="beam beam-one" aria-hidden="true" />
      <div className="beam beam-two" aria-hidden="true" />
      <div className="noise-layer" aria-hidden="true" />
    </main>
  );
}
