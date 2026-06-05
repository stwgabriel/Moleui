import { useState } from 'react';
import { Trash2, PackageX, Zap, PieChart, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FEATURE_ACCENTS } from '@/lib/featureAccents';
import type { PageId } from '@/types';

type FeatureId = 'clean' | 'uninstall' | 'optimize' | 'analyze';

interface Feature {
  id: FeatureId;
  icon: React.ElementType;
  label: string;
  description: string;
  animation: string;
}

const features: Feature[] = [
  {
    id: 'clean',
    icon: Trash2,
    label: 'Clean',
    description: 'Remove caches, logs, and junk files to reclaim disk space.',
    animation: 'animate-bounce-gentle',
  },
  {
    id: 'uninstall',
    icon: PackageX,
    label: 'Uninstall',
    description: 'Completely remove apps and every trace they leave behind.',
    animation: 'animate-shake',
  },
  {
    id: 'optimize',
    icon: Zap,
    label: 'Optimize',
    description: 'Tune system settings and run maintenance for peak performance.',
    animation: 'animate-pulse-glow',
  },
  {
    id: 'analyze',
    icon: PieChart,
    label: 'Analyze',
    description: "Visualize what's eating your disk and find large files instantly.",
    animation: 'animate-spin-slow',
  },
];

const defaultHero = {
  icon: Sparkles,
  color: FEATURE_ACCENTS.uninstall.accent,
  animation: 'animate-sparkle',
  dropShadow: `drop-shadow(0 8px 24px ${FEATURE_ACCENTS.uninstall.glow})`,
};

interface HomePageProps {
  onNavigate: (page: PageId) => void;
  onSkipToHome?: () => void;
}

export function HomePage({ onNavigate, onSkipToHome }: HomePageProps) {
  const [hoveredId, setHoveredId] = useState<FeatureId | null>(null);

  const active = hoveredId ? features.find((f) => f.id === hoveredId) : null;
  const HeroIcon = active ? active.icon : defaultHero.icon;
  const activeAccent = active ? FEATURE_ACCENTS[active.id] : null;
  const heroColor = activeAccent ? activeAccent.accent : defaultHero.color;
  const heroAnimation = active ? active.animation : defaultHero.animation;
  const heroShadow = activeAccent ? `drop-shadow(0 8px 32px ${activeAccent.glow})` : defaultHero.dropShadow;

  return (
    <div className="h-full flex flex-col items-center">
      <div className="flex-1 w-full max-w-[850px] mx-auto grid grid-cols-2 gap-12 p-12">

        {/* Left — feature list */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Where do you want to start?
          </h1>
          <p className="text-lg text-text-secondary mb-8">
            Pick a tool and let Moleui do the heavy lifting.
          </p>

          <div className="space-y-2">
            {features.map((f) => {
              const Icon = f.icon;
              const isHovered = hoveredId === f.id;
              const accent = FEATURE_ACCENTS[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => onNavigate(f.id)}
                  onMouseEnter={() => setHoveredId(f.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={cn(
                    'group w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left',
                    'transition-all duration-150 ease-smooth',
                    'hover:scale-[1.01] active:scale-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2'
                  )}
                  style={{
                    backgroundColor: isHovered ? `rgba(${accent.rgb},0.07)` : 'transparent',
                  }}
                  aria-label={`Go to ${f.label}`}
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: `rgba(${accent.rgb},0.10)` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: accent.accent }} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-sm leading-tight transition-colors duration-150"
                      style={{ color: isHovered ? accent.accent : undefined }}
                    >
                      {f.label}
                    </div>
                    <div className="text-xs text-text-secondary leading-snug mt-0.5">
                      {f.description}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight
                    className="w-4 h-4 flex-shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150"
                    style={{ color: accent.accent }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right — hero icon that reacts to hover */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <HeroIcon
              key={hoveredId ?? 'default'}
              className={`w-64 h-64 ${heroAnimation}`}
              style={{
                color: heroColor,
                strokeWidth: 1.5,
                filter: heroShadow,
                transition: 'color 300ms ease, filter 300ms ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-8 flex flex-col items-center gap-3 w-full max-w-[850px] mx-auto">
        
        {onSkipToHome && (
          <button
            onClick={onSkipToHome}
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors duration-150"
            aria-label="Skip to Home Screen"
          >
            Skip to Home Screen
          </button>
        )}
      </div>
    </div>
  );
}
