'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const releasePage = 'https://github.com/stwgabriel/moleui/releases';

const productViews = [
  {
    id: 'clean',
    label: 'Cleanup',
    title: 'Reclaim space you can actually see.',
    description: 'Moleui scans known cleanup areas, then shows the real findings before anything changes.',
    image: '/product/clean.webp',
    tone: 'blue',
  },
  {
    id: 'analyze',
    label: 'Storage',
    title: 'Find what is filling your Mac.',
    description: 'Explore large folders and files visually. Analysis stays read-only until you choose an item and confirm a Trash action.',
    image: '/product/analyze.webp',
    tone: 'pink',
  },
  {
    id: 'optimize',
    label: 'Performance',
    title: 'Maintenance without the mystery.',
    description: 'Preview selected system tune-ups and understand the work before you apply it.',
    image: '/product/optimize.webp',
    tone: 'violet',
  },
  {
    id: 'unistall',
    label: 'Uninstall',
    title: 'Remove the app, not your confidence.',
    description: 'Review related support files while protected system paths remain off limits.',
    image: '/product/unistall.webp',
    tone: 'red',
  },
] as const;

const safetySteps = [
  ['Scan', 'Moleui inspects known targets and reports what it finds.'],
  ['Review', 'You see the categories, files, and proposed work.'],
  ['Confirm', 'Nothing higher-risk proceeds without an explicit choice.'],
  ['Recover', 'Where supported, removal routes through Trash and is logged locally.'],
] as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function useLandingMotion() {
  const heroRef = useRef<HTMLElement | null>(null);
  const safetyRef = useRef<HTMLElement | null>(null);
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const finalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const hero = heroRef.current;
    const safety = safetyRef.current;
    const showcase = showcaseRef.current;
    const finalCta = finalRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const revealNodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    productViews.slice(1).forEach((view) => {
      const image = new Image();
      image.src = view.image;
    });

    if (reduceMotion) {
      revealNodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    revealNodes.forEach((node) => {
      if (node.getBoundingClientRect().top < window.innerHeight * 0.92) node.classList.add('is-visible');
      else observer.observe(node);
    });

    root.classList.add('motion-ready');

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let showcaseX = 0;
    let showcaseY = 0;

    const update = () => {
      frame = 0;

      if (hero) {
        const rect = hero.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        const progress = clamp(-rect.top / travel);
        const windowTravel = Math.min(560, window.innerHeight * 0.58);
        hero.style.setProperty('--hero-progress', progress.toFixed(4));
        hero.style.setProperty('--hero-copy-opacity', clamp(1 - progress * 1.45, 0.04, 1).toFixed(4));
        hero.style.setProperty('--hero-copy-y', `${(-progress * 110).toFixed(2)}px`);
        hero.style.setProperty('--hero-window-y', `${(-progress * windowTravel).toFixed(2)}px`);
        hero.style.setProperty('--hero-window-scale', (0.88 + progress * 0.12).toFixed(4));
        hero.style.setProperty('--hero-terrain-y', `${(-progress * 48).toFixed(2)}px`);
        hero.style.setProperty('--hero-terrain-scale', (1.02 + progress * 0.08).toFixed(4));
        hero.style.setProperty('--hero-cue-opacity', clamp(1 - progress * 5).toFixed(4));
        const reviewProgress = clamp((progress - 0.28) / 0.3);
        const foregroundProgress = clamp((progress - 0.14) / 0.58);
        hero.style.setProperty('--hero-scan-opacity', (1 - reviewProgress).toFixed(4));
        hero.style.setProperty('--hero-review-opacity', reviewProgress.toFixed(4));
        hero.style.setProperty('--hero-scan-scale', (1.015 - progress * 0.015).toFixed(4));
        hero.style.setProperty('--hero-review-scale', (1.025 - reviewProgress * 0.025).toFixed(4));
        hero.style.setProperty('--hero-state-opacity', clamp((progress - 0.08) / 0.16).toFixed(4));
        hero.style.setProperty('--hero-foreground-opacity', (foregroundProgress * 0.96).toFixed(4));
        hero.style.setProperty('--hero-foreground-y', `${(92 - foregroundProgress * 52).toFixed(2)}px`);
        hero.style.setProperty('--hero-left-x', `${(-220 + foregroundProgress * 170).toFixed(2)}px`);
        hero.style.setProperty('--hero-right-x', `${(220 - foregroundProgress * 170).toFixed(2)}px`);
        hero.style.setProperty('--pointer-x', `${(pointerX * 8).toFixed(2)}px`);
        hero.style.setProperty('--pointer-y', `${(pointerY * 6).toFixed(2)}px`);
        const heroCopy = hero.querySelector<HTMLElement>('.hero-copy');
        if (progress > 0.72) heroCopy?.setAttribute('inert', '');
        else heroCopy?.removeAttribute('inert');
      }

      if (safety) {
        const rect = safety.getBoundingClientRect();
        const progress = clamp((window.innerHeight * 0.72 - rect.top) / Math.max(rect.height, 1));
        safety.style.setProperty('--safety-progress', progress.toFixed(4));
      }

      if (showcase) {
        showcase.style.setProperty('--showcase-shift-x', `${(showcaseX * 9).toFixed(2)}px`);
        showcase.style.setProperty('--showcase-shift-y', `${(showcaseY * 7).toFixed(2)}px`);
        showcase.style.setProperty('--showcase-shift-x-inverse', `${(-showcaseX * 9).toFixed(2)}px`);
        showcase.style.setProperty('--showcase-shift-y-inverse', `${(-showcaseY * 7).toFixed(2)}px`);
        showcase.style.setProperty('--showcase-tilt-x', `${(-showcaseY * 2.2).toFixed(2)}deg`);
        showcase.style.setProperty('--showcase-tilt-y', `${(showcaseX * 2.2).toFixed(2)}deg`);
      }

      if (finalCta) {
        const rect = finalCta.getBoundingClientRect();
        const progress = clamp((window.innerHeight - rect.top) / Math.max(window.innerHeight + rect.height, 1));
        finalCta.style.setProperty('--final-progress', progress.toFixed(4));
        finalCta.style.setProperty('--final-terrain-y', `${((0.5 - progress) * 36).toFixed(2)}px`);
        finalCta.style.setProperty('--final-terrain-scale', (1.04 + progress * 0.035).toFixed(4));
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!finePointer) return;
      pointerX = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
      pointerY = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);

      if (showcase) {
        const rect = showcase.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        showcaseX = inside ? clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) : 0;
        showcaseY = inside ? clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) : 0;
      }
      schedule();
    };

    const handleVisibility = () => root.classList.toggle('motion-paused', document.hidden);

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (finePointer) window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    schedule();

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibility);
      root.classList.remove('motion-ready', 'motion-paused');
    };
  }, []);

  return { heroRef, safetyRef, showcaseRef, finalRef };
}

function DownloadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [arch, setArch] = useState<'arm64' | 'x64'>('arm64');
  const dialogRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const archRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectArch = (nextArch: 'arm64' | 'x64', index: number) => {
    setArch(nextArch);
    requestAnimationFrame(() => archRefs.current[index]?.focus());
  };

  const handleArchKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % 2;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index + 1) % 2;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectArch(nextIndex === 0 ? 'arm64' : 'x64', nextIndex);
  };

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const page = document.querySelector('main');
    const background = page ? Array.from(page.children).filter((child) => !child.classList.contains('download-backdrop')) : [];
    background.forEach((child) => child.setAttribute('inert', ''));
    document.body.style.overflow = 'hidden';

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const dialog = dialogRef.current;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element.getAttribute('aria-disabled') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (active === dialog || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDocumentKeyDown);
      background.forEach((child) => child.removeAttribute('inert'));
      document.body.style.overflow = '';
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="download-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="download-sheet"
        aria-modal="true"
        aria-labelledby="download-title"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="sheet-close" onClick={onClose} aria-label="Close download options">×</button>
        <img className="sheet-mark" src="/product/moleui-mark.webp" width="160" height="160" alt="" />
        <p className="overline">Moleui for macOS</p>
        <h2 id="download-title">Download Moleui</h2>
        <p className="sheet-copy">Choose the processor inside your Mac. The installer downloads without replacing this page.</p>
        <div className="arch-options" role="radiogroup" aria-label="Mac processor">
          <button ref={(node) => { archRefs.current[0] = node; }} className={arch === 'arm64' ? 'arch-option selected' : 'arch-option'} onClick={() => setArch('arm64')} onKeyDown={(event) => handleArchKeyDown(event, 0)} tabIndex={arch === 'arm64' ? 0 : -1} role="radio" aria-checked={arch === 'arm64'}>
            <strong>Apple Silicon</strong><span>M1, M2, M3, M4 and newer</span>
          </button>
          <button ref={(node) => { archRefs.current[1] = node; }} className={arch === 'x64' ? 'arch-option selected' : 'arch-option'} onClick={() => setArch('x64')} onKeyDown={(event) => handleArchKeyDown(event, 1)} tabIndex={arch === 'x64' ? 0 : -1} role="radio" aria-checked={arch === 'x64'}>
            <strong>Intel</strong><span>Older Intel-based Macs</span>
          </button>
        </div>
        {arch === 'arm64' ? (
          <a className="button button-dark download-button" href="/download/macos/arm64">Download for Apple Silicon <span aria-hidden="true">↓</span></a>
        ) : (
          <span className="button button-unavailable download-button" aria-disabled="true">Intel installer unavailable</span>
        )}
        {arch === 'x64' && <p className="availability-note" role="status">The current release does not include an Intel DMG. Choose Apple Silicon on an M1, M2, M3, M4, or newer Mac.</p>}
        <ol className="install-steps">
          <li><b>1</b><span>Open the downloaded DMG.</span></li>
          <li><b>2</b><span>Drag Moleui into Applications.</span></li>
          <li><b>3</b><span>Open Moleui and review your Mac.</span></li>
        </ol>
      </section>
    </div>
  );
}

export default function Page() {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [activeView, setActiveView] = useState<(typeof productViews)[number]>(productViews[0]);
  const { heroRef, safetyRef, showcaseRef, finalRef } = useLandingMotion();
  const openDownload = () => setDownloadOpen(true);

  const selectProductView = (index: number) => {
    const nextView = productViews[index];
    setActiveView(nextView);
    requestAnimationFrame(() => document.getElementById(`product-tab-${nextView.id}`)?.focus());
  };

  const handleProductTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % productViews.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + productViews.length) % productViews.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = productViews.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectProductView(nextIndex);
  };

  return (
    <main>
      <section ref={heroRef} className="hero" id="top">
        <div className="hero-stage">
          <div className="hero-terrain" aria-hidden="true" />
          <div className="hero-light hero-light-a" aria-hidden="true" />
          <div className="hero-light hero-light-b" aria-hidden="true" />
          <header className="site-header">
          <a className="brand" href="#top" aria-label="Moleui home">
            <img src="/product/moleui-mark.webp" width="160" height="160" alt="" />
            <span>Moleui</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#safety">Safety</a>
            <a href="#guides">Guides</a>
            <a href={releasePage} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <div className="header-actions">
            <a className="account-link" href="/sign-in">Sign in</a>
            <a className="account-link" href="/sign-up">Sign up</a>
            <button className="button button-dark header-download" onClick={openDownload}>Download</button>
          </div>
          </header>

          <div className="hero-copy">
            <p className="hero-kicker"><span aria-hidden="true">●</span> Safety-first maintenance for macOS</p>
            <h1><span className="headline-line">A cleaner Mac.</span><span className="headline-line">Nothing you didn’t approve.</span></h1>
            <p>Moleui helps you understand storage, review cleanup candidates, and maintain your Mac without handing over the wheel.</p>
            <button className="button button-dark hero-button" onClick={openDownload}>Download for macOS <span aria-hidden="true">↓</span></button>
            <div className="hero-facts" aria-label="Product facts">
              <span>Open source</span>
              <span>Preview first</span>
              <span>macOS only</span>
              <span>Local operation logs</span>
            </div>
          </div>

          <div className="hero-window-track">
            <div className="hero-state" aria-hidden="true">
              <span className="hero-state-scan">01&nbsp;&nbsp;Inspect what is using space</span>
              <span className="hero-state-review">02&nbsp;&nbsp;Review and approve</span>
            </div>
            <div className="hero-window">
              <div className="hero-screen hero-screen-scan" aria-hidden="true">
                <img src="/product/analyze.webp" width="1600" height="1044" alt="" />
              </div>
              <div className="hero-screen hero-screen-review">
                <img src="/product/clean.webp" width="1600" height="1044" alt="Moleui cleanup screen with reviewable storage categories" />
              </div>
            </div>
          </div>
          <div className="hero-foreground hero-foreground-left" aria-hidden="true"><span /></div>
          <div className="hero-foreground hero-foreground-right" aria-hidden="true"><span /></div>
          <div className="hero-scroll-cue" aria-hidden="true"><span /> Scroll to explore</div>
        </div>
      </section>

      <section className="mission" id="features">
        <div data-reveal>
          <p className="overline">Everything in one thoughtful place</p>
          <h2>See what’s taking space.<br />Decide what happens next.</h2>
          <p className="section-lead">From everyday clutter to developer caches and inactive repositories, Moleui makes the next action visible before it happens.</p>
        </div>
        <div className="capability-pills" aria-label="Moleui capabilities" data-reveal>
          {['System health', 'Cleanup', 'Storage', 'Uninstall', 'Optimize', 'Automations', 'Repositories', 'Installers'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <section className={`product-showcase tone-${activeView.tone}`} aria-labelledby="showcase-title">
        <div className="showcase-heading" data-reveal>
          <p className="overline">The product, not a promise</p>
          <h2 id="showcase-title">Tools that show their work.</h2>
          <p>Explore the actual Moleui interface. Every workspace starts with context, then asks you to choose.</p>
        </div>
        <div className="showcase-tabs" role="tablist" aria-label="Product views" data-reveal>
          {productViews.map((view, index) => (
            <button
              key={view.id}
              id={`product-tab-${view.id}`}
              role="tab"
              aria-controls="product-panel"
              aria-selected={activeView.id === view.id}
              tabIndex={activeView.id === view.id ? 0 : -1}
              className={activeView.id === view.id ? 'active' : ''}
              onClick={() => setActiveView(view)}
              onKeyDown={(event) => handleProductTabKeyDown(event, index)}
            >
              {view.label}
            </button>
          ))}
        </div>
        <div ref={showcaseRef} id="product-panel" className="showcase-canvas" role="tabpanel" aria-live="polite" aria-labelledby={`product-tab-${activeView.id}`} data-reveal>
          <div className="showcase-copy" key={`${activeView.id}-copy`}>
            <span>{activeView.label}</span>
            <h3>{activeView.title}</h3>
            <p>{activeView.description}</p>
          </div>
          <div className="showcase-window-shell">
            <div className="showcase-window" key={activeView.id}>
              <img src={activeView.image} width="1600" height="1044" alt={`Moleui ${activeView.label} interface`} />
            </div>
          </div>
        </div>
      </section>

      <section ref={safetyRef} className="safety" id="safety">
        <div className="safety-intro" data-reveal>
          <p className="overline">The Moleui difference</p>
          <h2>It asks<br />before it acts.</h2>
          <p>Safety is not a badge on the website. It is the order of operations inside the app.</p>
        </div>
        <div className="safety-path" aria-label="Moleui safety workflow">
          <div className="safety-rail" aria-hidden="true"><span /></div>
          {safetySteps.map(([title, copy], index) => (
            <article key={title} data-reveal>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
        <p className="safety-note" data-reveal>Automations require a passing dry run. Repository archives verify remote state before anything moves. Review selections before confirming any operation.</p>
      </section>

      <section className="depth-section">
        <div className="depth-heading" data-reveal>
          <p className="overline">More than a cleaner</p>
          <h2>Made for the Mac you actually use.</h2>
        </div>
        <div className="depth-grid">
          <article data-reveal>
            <span>My Mac</span>
            <h3>Health at a glance.</h3>
            <p>CPU, memory, storage, network, battery, apps, and processes in one calm view.</p>
          </article>
          <article data-reveal>
            <span>Automations</span>
            <h3>Routines with guardrails.</h3>
            <p>Schedule allowlisted cleanups only after a dry run passes and the Mac is ready.</p>
          </article>
          <article data-reveal>
            <span>For developers</span>
            <h3>Repositories stay accounted for.</h3>
            <p>Inventory local work and verify every remote branch and tag before archiving to Trash.</p>
          </article>
        </div>
      </section>

      <section className="guides" id="guides">
        <div className="guides-heading" data-reveal><p className="overline">Learn before you clean</p><h2>Better decisions start with context.</h2></div>
        <div className="guide-links" data-reveal>
          <a href="/guides/free-up-mac-storage-safely"><span>Guide</span><strong>Free up Mac storage safely</strong><i>↗</i></a>
          <a href="/guides/find-large-files-on-mac"><span>Guide</span><strong>Find large files on Mac</strong><i>↗</i></a>
          <a href="/guides/uninstall-mac-apps-completely"><span>Guide</span><strong>Uninstall Mac apps completely</strong><i>↗</i></a>
          <a href="/guides/clear-developer-caches-with-context"><span>Guide</span><strong>Clear developer caches with context</strong><i>↗</i></a>
        </div>
      </section>

      <section ref={finalRef} className="final-cta">
        <div className="final-terrain" aria-hidden="true" />
        <div className="final-content" data-reveal>
          <img className="final-mark" src="/product/moleui-mark.webp" width="160" height="160" alt="" />
          <p className="overline">Moleui for macOS</p>
          <h2>Make room.<br />Keep control.</h2>
          <p>Start with a clearer picture of your Mac. Decide from there.</p>
          <button className="button button-dark" onClick={openDownload}>Download for macOS <span aria-hidden="true">↓</span></button>
        </div>
      </section>

      <footer>
        <a className="brand" href="#top"><img src="/product/moleui-mark.webp" width="160" height="160" alt="" /><span>Moleui</span></a>
        <p>Safety-first maintenance for macOS.</p>
        <div><a href="/sign-in">Sign in</a><a href="/sign-up">Sign up</a><a href={releasePage} target="_blank" rel="noreferrer">Releases</a><a href="https://github.com/stwgabriel/moleui/security/policy" target="_blank" rel="noreferrer">Security</a><a href="https://github.com/stwgabriel/moleui" target="_blank" rel="noreferrer">Source</a></div>
      </footer>

      <DownloadSheet open={downloadOpen} onClose={() => setDownloadOpen(false)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Moleui', applicationCategory: 'UtilitiesApplication', operatingSystem: 'macOS', description: 'Safety-first macOS maintenance for storage, cleanup, uninstall, optimization, and system insight.', downloadUrl: '/download/macos/arm64', license: 'https://opensource.org/license/mit' }) }} />
    </main>
  );
}
