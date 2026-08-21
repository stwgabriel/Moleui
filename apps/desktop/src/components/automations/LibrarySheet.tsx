import { Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { AUTOMATION_CATALOG, type AutomationTemplate } from '@/lib/automationCatalog';
import { MarketplaceCard } from './MarketplaceCard';

// The catalogue, moved off the landing view.
//
// It used to occupy the largest share of the page, above the activity log and below
// an empty "My recipes" heading, which made browsing other people's suggestions the
// first thing the page did. It belongs behind an explicit affordance: the page
// should open on what the user already has.
//
// The one substantive rule here is that a card is only offerable if every section
// its action names is in the allowlist the main process reported. If they ever drift
// apart, the main process silently narrows the action on save, and the card would go
// on advertising something wider than what was actually created.

interface LibrarySheetProps {
  open: boolean;
  onClose: () => void;
  addedCatalogIds: Set<string>;
  allowedSections: string[];
  onAdd: (template: AutomationTemplate) => void;
  onNewRecipe: () => void;
}

export function LibrarySheet({
  open,
  onClose,
  addedCatalogIds,
  allowedSections,
  onAdd,
  onNewRecipe,
}: LibrarySheetProps) {
  const allowed = new Set(allowedSections);
  const everythingAdded = AUTOMATION_CATALOG.every((template) => addedCatalogIds.has(template.id));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Recipe library"
      description="Curated recipes. Adding one only creates it. It stays off until a dry run passes."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.8rem] font-medium text-slate-500 dark:text-slate-400">
            {everythingAdded
              ? 'Every recipe in the library has been added.'
              : 'Nothing here runs until you enable it.'}
          </p>
          <Button variant="glass" size="sm" icon={Plus} onClick={onNewRecipe}>
            Build a custom recipe
          </Button>
        </div>
      }
    >
      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {AUTOMATION_CATALOG.map((template) => (
          <MarketplaceCard
            key={template.id}
            template={template}
            added={addedCatalogIds.has(template.id)}
            unavailable={template.action.sections.some((section) => !allowed.has(section))}
            onAdd={onAdd}
          />
        ))}
      </div>
    </Sheet>
  );
}
