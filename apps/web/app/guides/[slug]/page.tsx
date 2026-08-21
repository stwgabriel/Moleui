import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const guides = {
  'free-up-mac-storage-safely': { title: 'Free up Mac storage safely', intro: 'Start by seeing what uses space. Review cleanup candidates and select only the items you understand before confirming a change.', steps: ['Open Storage to inspect large files and folders.', 'Run a cleanup scan to see candidates in the safe cleanup areas.', 'Review the findings and your selections before any removal.'] },
  'find-large-files-on-mac': { title: 'Find large files on Mac', intro: 'Large files are context, not automatic junk. Inspect where they live and whether they are still useful before moving any item to Trash.', steps: ['Use Storage to map folders and large files.', 'Check project folders, downloads, media libraries, and old installers.', 'Move only confirmed items through a reviewable removal flow.'] },
  'uninstall-mac-apps-completely': { title: 'Uninstall Mac apps completely', intro: 'Removing an app can leave preferences, support files, logs, and launch items behind. A complete uninstall starts with a review, not a broad sweep.', steps: ['Select the app you want to remove.', 'Review its related files and keep protected system paths untouched.', 'Confirm the final selection before removal.'] },
  'clear-developer-caches-with-context': { title: 'Clear developer caches with context', intro: 'Build artifacts and tool caches can be large, but active versions, credentials, and projects deserve care. Treat each cache as a decision.', steps: ['Inspect developer caches and project artifacts first.', 'Keep active workspaces and configuration outside cleanup selections.', 'Review output before confirming any removal.'] },
} as const;

type GuideSlug = keyof typeof guides;

export function generateStaticParams() { return Object.keys(guides).map((slug) => ({ slug })); }
export function generateMetadata({ params }: { params: { slug: string } }): Metadata { const guide = guides[params.slug as GuideSlug]; return guide ? { title: `${guide.title} | Moleui`, description: guide.intro, alternates: { canonical: `/guides/${params.slug}` } } : {}; }

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = guides[params.slug as GuideSlug];
  if (!guide) notFound();
  return <main className="guide-page"><header><a className="brand" href="/">← Moleui</a><a href="/sign-up">Create an account</a></header><article><p className="overline">Moleui guide</p><h1>{guide.title}</h1><p className="guide-intro">{guide.intro}</p><h2>A careful way to begin</h2><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol><a className="button button-dark" href="/">Explore Moleui <span aria-hidden="true">→</span></a></article></main>;
}
