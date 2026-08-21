import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { CLEAN_SECTION_DESCRIPTIONS, WEEKDAY_LABELS, type AutomatableCleanSection } from '@/lib/automationCatalog';
import type { AutomationActionKind, AutomationFrequency, AutomationRecipe, AutomationRecipeInput } from '@/types';

interface RecipeEditorProps {
  recipe: AutomationRecipe | null;
  /** Allowlist reported by the main process. The UI never offers anything else. */
  allowedSections: string[];
  onCancel: () => void;
  onSave: (input: AutomationRecipeInput) => void;
}

export function RecipeEditor({ recipe, allowedSections, onCancel, onSave }: RecipeEditorProps) {
  const [name, setName] = useState(recipe?.name ?? 'Custom cleanup');
  const [kind, setKind] = useState<AutomationActionKind>(recipe?.action.kind ?? 'clean');
  const [sections, setSections] = useState<string[]>(recipe?.action.sections ?? []);
  const [frequency, setFrequency] = useState<AutomationFrequency>(recipe?.schedule.frequency ?? 'weekly');
  const [weekday, setWeekday] = useState(recipe?.schedule.weekday ?? 0);
  const [hour, setHour] = useState(recipe?.schedule.hour ?? 3);
  const [minute, setMinute] = useState(recipe?.schedule.minute ?? 0);

  const canSave = name.trim().length > 0 && (kind === 'installer' || sections.length > 0);

  const toggleSection = (section: string) => {
    setSections((previous) =>
      previous.includes(section) ? previous.filter((entry) => entry !== section) : [...previous, section],
    );
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: recipe?.id,
      catalogId: recipe?.catalogId ?? 'custom',
      name: name.trim(),
      action: { kind, sections: kind === 'clean' ? sections : [] },
      schedule: { frequency, hour, minute, weekday },
    });
  };

  return (
    // A labelled region inside the sheet. The sheet supplies the dialog, the
    // heading and the close control; this owns the form only.
    <section aria-label={recipe ? `Edit ${recipe.name}` : 'New recipe'}>
      <label className="block">
        <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Name</span>
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 text-[0.85rem] text-slate-800 outline-none focus:ring-2 focus:ring-[rgba(var(--page-accent-rgb),0.4)] dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Action</legend>
        <div className="mt-1 flex gap-2">
          {(['clean', 'installer'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className={cn(
                'rounded-full px-3 py-1.5 text-[0.8rem] font-semibold transition-colors duration-200',
                kind === option
                  ? 'bg-[rgba(var(--page-accent-rgb),0.18)] text-[var(--page-accent)]'
                  : 'bg-white/60 text-slate-500 ring-1 ring-black/5 hover:text-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-white/10',
              )}
            >
              {option === 'clean' ? 'Cleanup sections' : 'Installer sweep'}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'clean' && (
        <fieldset className="mt-3">
          <legend className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">
            Sections ({sections.length} selected)
          </legend>
          <p className="mt-0.5 text-[0.7rem] text-slate-400 dark:text-slate-500">
            Only sections that run unattended without sudo are offered here.
          </p>
          {allowedSections.length === 0 ? (
            <p className="mt-1.5 rounded-[1.25rem] bg-amber-500/10 px-3 py-2 text-[0.78rem] font-semibold text-amber-700 dark:text-amber-300">
              This build offers no automatable cleanup sections.
            </p>
          ) : (
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {allowedSections.map((section) => {
                const active = sections.includes(section);
                return (
                  <label
                    key={section}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-[1.25rem] border px-3 py-2.5 transition-colors',
                      'focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--page-accent)] focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-900',
                      active
                        ? 'border-[rgba(var(--page-accent-rgb),0.55)] bg-[rgba(var(--page-accent-rgb),0.10)]'
                        : 'border-white/60 bg-white/55 hover:bg-white/80 dark:border-white/10 dark:bg-slate-950/40 dark:hover:bg-slate-900/60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={active}
                      onChange={() => toggleSection(section)}
                      aria-label={section}
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors',
                        active
                          ? 'border-[var(--page-accent)] bg-[var(--page-accent)] text-white'
                          : 'border-slate-300 bg-white/70 text-transparent dark:border-slate-600 dark:bg-slate-900/70',
                      )}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.82rem] font-bold text-slate-800 dark:text-slate-100">{section}</span>
                      <span className="block text-[0.7rem] leading-snug text-slate-400 dark:text-slate-500">
                        {CLEAN_SECTION_DESCRIPTIONS[section as AutomatableCleanSection] ?? ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Frequency</span>
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as AutomationFrequency)}
            className="mt-1 rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 text-[0.8rem] text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>

        {frequency === 'weekly' && (
          <label className="block">
            <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Day</span>
            <select
              value={weekday}
              onChange={(event) => setWeekday(Number(event.target.value))}
              className="mt-1 rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 text-[0.8rem] text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
            >
              {WEEKDAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Hour</span>
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className="mt-1 w-20 rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 text-[0.8rem] text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300">Minute</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(event) => setMinute(Number(event.target.value))}
            className="mt-1 w-20 rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 text-[0.8rem] text-slate-800 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
          />
        </label>
      </div>

      <p className="mt-3 text-[0.75rem] text-slate-400 dark:text-slate-500">
        Saving a changed action clears the previous dry run, so the recipe has to pass a new one before it can be enabled.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-full bg-[var(--page-accent)] px-4 py-2 text-[0.82rem] font-bold text-white shadow-[0_10px_26px_rgba(var(--page-accent-rgb),0.32)] transition-colors duration-200 hover:bg-[var(--page-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--page-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
        >
          Save recipe
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-[0.8rem] font-semibold text-slate-500 transition-colors duration-200 hover:bg-slate-500/10 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
