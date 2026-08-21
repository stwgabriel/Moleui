import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, LibraryBig, Plus, ShieldCheck, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { featureAccentVars } from '@/lib/featureAccents';
import { type AutomationTemplate } from '@/lib/automationCatalog';
import { useAutomations } from '@/hooks/useAutomations';
import { usePermissions } from '@/hooks/usePermissions';
import { StartScreen } from '@/components/common/StartScreen';
import { StageTransition } from '@/components/common/StageTransition';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ActivityPanel } from '@/components/automations/ActivityPanel';
import { LibrarySheet } from '@/components/automations/LibrarySheet';
import { NextRunsPanel } from '@/components/automations/NextRunsPanel';
import { RecipeEditor } from '@/components/automations/RecipeEditor';
import { RecipeRow } from '@/components/automations/RecipeRow';
import { MasterSwitch } from '@/components/automations/switches';
import type { AutomationRecipe, PageConfig } from '@/types';

type EditorTarget = { mode: 'closed' } | { mode: 'new' } | { mode: 'edit'; recipe: AutomationRecipe };

// Three questions, in the order the user asks them: what runs next, what is armed,
// and did the last runs work.
//
// The page used to open on a five-card catalogue above an empty "My recipes"
// heading, with the schedule buried in a 2x2 definition list. The catalogue is now
// behind a Browse library affordance, and the schedule is the hero.

const SECTION_LABEL = 'text-[0.7rem] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500';

const config: PageConfig = {
  title: 'Automate your cleanup',
  description: 'Set recurring cleanup routines that run when your Mac is ready, with a dry run before anything is enabled.',
  icon: 'CalendarClock',
  buttonText: 'Set Up Automations',
  items: [
    {
      icon: 'CalendarDays',
      title: 'Choose a schedule',
      description: 'Set a daily or weekly rhythm for the cleanup you want to repeat.',
    },
    {
      icon: 'ShieldCheck',
      title: 'Preview before enabling',
      description: 'Every recipe needs a passing dry run before it can run unattended.',
    },
    {
      icon: 'BatteryCharging',
      title: 'Run when your Mac is ready',
      description: 'Mole waits for power and idle time before starting a scheduled cleanup.',
    },
  ],
};

export function AutomationsPage() {
  const automations = useAutomations();
  const permissions = usePermissions();
  const [editor, setEditor] = useState<EditorTarget>({ mode: 'closed' });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [started, setStarted] = useState(false);

  const { state, loading, busyRecipeId, error } = automations;
  const accentStyle = featureAccentVars('automations');

  const addedCatalogIds = useMemo(
    () => new Set(state.recipes.map((recipe) => recipe.catalogId)),
    [state.recipes],
  );

  const handleAddTemplate = async (template: AutomationTemplate) => {
    const saved = await automations.saveRecipe({
      catalogId: template.id,
      name: template.name,
      action: template.action,
      schedule: template.schedule,
    });
    if (saved) setStatus(`${template.name} added. It stays off until a dry run passes.`);
  };

  const enabledCount = state.recipes.filter((recipe) => recipe.enabled).length;
  const showWorkspace = started || state.recipes.length > 0;

  // The library and the editor are the same kind of layer, so only one is ever open.
  useEffect(() => {
    if (editor.mode !== 'closed') setLibraryOpen(false);
  }, [editor.mode]);

  const workspace = (
    <div style={accentStyle} className="relative flex h-full flex-col overflow-hidden pt-1">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(var(--page-accent-rgb),0.16),transparent_36%),radial-gradient(circle_at_12%_88%,rgba(109,93,252,0.10),transparent_38%)]" />

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <header className="relative shrink-0 px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--page-accent-rgb),0.14)] text-[var(--page-accent)]"
              aria-hidden="true"
            >
              <CalendarClock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-[-0.045em] text-slate-950 dark:text-slate-100">
                Automations
              </h1>
              <p className="mt-1.5 max-w-2xl text-[0.88rem] font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                Recurring cleanups that delete files on a schedule while Moleui is open, on power, and while the Mac is
                idle. Every recipe has to pass a dry run before it can be enabled.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <MasterSwitch
              paused={state.paused}
              describedBy="automations-scheduler-status"
              onToggle={() => void automations.setPaused(!state.paused)}
            />
            <Button variant="glass" size="sm" icon={LibraryBig} onClick={() => setLibraryOpen(true)}>
              Browse library
            </Button>
            <Button
              variant="glass"
              size="sm"
              icon={Plus}
              onClick={() => setEditor({ mode: 'new' })}
              className="text-[var(--page-accent)] ring-1 ring-[rgba(var(--page-accent-rgb),0.35)]"
            >
              New recipe
            </Button>
          </div>
        </div>

        <p
          id="automations-scheduler-status"
          className="mt-2 text-[0.78rem] font-semibold text-slate-500 dark:text-slate-400"
        >
          {state.paused
            ? 'All automations are paused.'
            : state.scheduler.running
              ? 'Scheduler checks every minute while Moleui is open.'
              : 'Scheduler is not running.'}
          {' '}
          {enabledCount} of {state.recipes.length} enabled.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-[1.25rem] bg-red-500/10 px-3.5 py-2.5 text-[0.82rem] font-semibold text-red-700 dark:text-red-300"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={automations.dismissError}
              className="rounded-full p-0.5 hover:bg-red-500/15"
              aria-label="Dismiss message"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </header>

      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden px-5 pb-5">
        <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,21rem)]">
          <div className="min-h-0 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
            <NextRunsPanel
              recipes={state.recipes}
              paused={state.paused}
              schedulerRunning={state.scheduler.running}
              fullDiskAccess={permissions.fullDiskAccess}
              onOpenLibrary={() => setLibraryOpen(true)}
              onNewRecipe={() => setEditor({ mode: 'new' })}
              onOpenPermissions={() => permissions.openSettings('fullDiskAccess')}
            />

            {state.recipes.length > 0 && (
              <section aria-labelledby="automations-recipes-heading">
                <h2 id="automations-recipes-heading" className={cn('px-1', SECTION_LABEL)}>
                  My recipes
                </h2>
                {loading ? (
                  <p className="mt-2 rounded-[1.5rem] bg-white/50 px-3 py-6 text-center text-[0.82rem] font-medium text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
                    Loading automations…
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2.5">
                    {state.recipes.map((recipe) => (
                      <RecipeRow
                        key={recipe.id}
                        recipe={recipe}
                        busy={busyRecipeId === recipe.id}
                        paused={state.paused}
                        onToggleEnabled={(target, enabled) => void automations.setEnabled(target.id, enabled)}
                        onDryRun={(target) => {
                          setStatus(`Dry run started for ${target.name}.`);
                          void automations.dryRun(target.id);
                        }}
                        onRunNow={(target) => {
                          setStatus(`${target.name} started.`);
                          void automations.runNow(target.id);
                        }}
                        onEdit={(target) => setEditor({ mode: 'edit', recipe: target })}
                        onDelete={(target) => void automations.deleteRecipe(target.id)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <div className="hidden min-h-0 lg:block">
            <ActivityPanel
              runs={state.runs}
              schedulerActive={state.scheduler.active}
              onCancel={() => void automations.cancel()}
            />
          </div>
        </div>
      </div>

      <LibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        addedCatalogIds={addedCatalogIds}
        allowedSections={state.allowlist.cleanSections}
        onAdd={(template) => void handleAddTemplate(template)}
        onNewRecipe={() => {
          setLibraryOpen(false);
          setEditor({ mode: 'new' });
        }}
      />

      <Sheet
        open={editor.mode !== 'closed'}
        onClose={() => setEditor({ mode: 'closed' })}
        title={editor.mode === 'edit' ? 'Edit recipe' : 'New recipe'}
        description="Only the cleanup sections the main process allows to run unattended are offered here."
        size="lg"
      >
        {editor.mode !== 'closed' && (
          <RecipeEditor
            recipe={editor.mode === 'edit' ? editor.recipe : null}
            allowedSections={state.allowlist.cleanSections}
            onCancel={() => setEditor({ mode: 'closed' })}
            onSave={async (input) => {
              const saved = await automations.saveRecipe(input);
              if (saved) setEditor({ mode: 'closed' });
            }}
          />
        )}
      </Sheet>
    </div>
  );

  return (
    <div style={accentStyle} className="relative h-full min-h-0">
      <StageTransition viewKey={showWorkspace ? 'workspace' : 'start'}>
        {showWorkspace ? workspace : <StartScreen config={config} onStart={() => setStarted(true)} variant="feature" />}
      </StageTransition>
    </div>
  );
}
