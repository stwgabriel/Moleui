import * as Icons from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { PageConfig } from '@/types';

interface StartScreenProps {
  config: PageConfig;
  onStart: () => void;
  variant?: 'default' | 'myMac' | 'uninstall' | 'feature';
}

// Icon color and animation mapping based on functionality
const iconConfig: Record<string, { color: string; animation: string; shadow: string }> = {
  Trash2: {
    color: '#3b82f6',
    animation: 'animate-bounce-gentle',
    shadow: 'drop-shadow(0 8px 18px rgba(59, 130, 246, 0.35))',
  }, // Clean - Blue
  PieChart: {
    color: '#ec4899',
    animation: 'animate-spin-slow',
    shadow: 'drop-shadow(0 8px 18px rgba(236, 72, 153, 0.32))',
  }, // Analyze - Pink
  Zap: {
    color: '#8b5cf6',
    animation: 'animate-pulse-glow',
    shadow: 'drop-shadow(0 8px 18px rgba(139, 92, 246, 0.35))',
  }, // Optimize - Purple
  Activity: {
    color: '#10b981',
    animation: 'animate-pulse-wave',
    shadow: 'drop-shadow(0 8px 18px rgba(16, 185, 129, 0.32))',
  }, // Status - Green
  PackageX: {
    color: '#ef4444',
    animation: 'animate-shake',
    shadow: 'drop-shadow(0 8px 18px rgba(239, 68, 68, 0.32))',
  }, // Uninstall - Red
  Sparkles: {
    color: '#f59e0b',
    animation: 'animate-sparkle',
    shadow: 'drop-shadow(0 8px 18px rgba(245, 158, 11, 0.32))',
  }, // Smart Care - Amber
};

const myMacCard =
  'bg-white/45 border border-white/55 shadow-[0_24px_80px_rgba(109,93,252,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl';

const myMacActionCard =
  'group relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] border border-white/55 bg-white/35 p-5 text-left shadow-[0_20px_60px_rgba(109,93,252,0.10),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/45';

const featureThemes: Record<string, { accent: string; glow: string; footerText: string }> = {
  PackageX: {
    accent: '#ff2d3d',
    glow: 'rgba(255,45,61,0.25)',
    footerText: 'Nothing will be removed without your permission',
  },
  Sparkles: {
    accent: '#3b82f6',
    glow: 'rgba(59,130,246,0.24)',
    footerText: 'Review cleanup results before anything is removed',
  },
  Gauge: {
    accent: '#8b5cf6',
    glow: 'rgba(139,92,246,0.25)',
    footerText: 'A preview runs before any optimization changes',
  },
  Database: {
    accent: '#ec4899',
    glow: 'rgba(236,72,153,0.24)',
    footerText: 'Analysis only reads your storage layout',
  },
};

const featureImages: Record<string, string> = {
  Sparkles: './assets/images/cleanup-3d.png',
  Gauge: './assets/images/performance-3d.png',
  Database: './assets/images/storage-3d.png',
  PackageX: './assets/images/uninstall-3d.png',
};

export function StartScreen({ config, onStart, variant = 'default' }: StartScreenProps) {
  // Map icon name to actual component
  const getIcon = (iconName: string) => {
    const Icon = Icons[iconName as keyof typeof Icons] as Icons.LucideIcon;
    return Icon;
  };

  const MainIcon = getIcon(config.icon);
  const iconStyle = iconConfig[config.icon] || {
    color: '#3b82f6',
    animation: '',
    shadow: 'drop-shadow(0 8px 24px rgba(59, 130, 246, 0.18))',
  };
  const featureTheme = featureThemes[config.icon] ?? {
    accent: iconStyle.color,
    glow: 'rgba(109,93,252,0.22)',
    footerText: 'Review the results before making changes',
  };
  const featureImage = featureImages[config.icon];

  if (variant === 'myMac') {
    return (
      <div className="relative h-full min-h-0 overflow-y-auto">
        <div className="relative flex min-h-full w-full items-center justify-center p-4 pb-28 sm:p-6 sm:pb-28 lg:pb-6">
          <div className="grid w-full max-w-[980px] grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Card className={`relative min-h-[440px] overflow-hidden rounded-[1.75rem] p-7 ${myMacCard}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(59,130,246,0.20),transparent_42%),radial-gradient(circle_at_88%_12%,rgba(109,93,252,0.14),transparent_36%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8 items-center">
                <div className="flex items-start justify-between gap-6 text-center">
                  <div className="min-w-0">
                    <h1 className="text-5xl font-black leading-none text-slate-950">{config.title}</h1>
                    <p className="mt-4 max-w-[34rem] text-lg font-medium leading-7 text-slate-600">
                      {config.description}
                    </p>
                  </div>
                  {/* {MainIcon && (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/35 shadow-[0_16px_44px_rgba(59,130,246,0.20)] backdrop-blur-xl">
                      <MainIcon
                        className={`h-12 w-12 ${iconStyle.animation}`}
                        style={{
                          color: iconStyle.color,
                          strokeWidth: 1.6,
                          filter: iconStyle.shadow,
                        }}
                      />
                    </div>
                  )} */}
                </div>

                <div className="rounded-3xl border border-white/60 bg-white/30 p-4 shadow-inner shadow-white/30 backdrop-blur-xl">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="font-bold text-slate-950">Scan first</div>
                      <div className="mt-1 font-medium text-slate-600">Preview removable data before anything is deleted.</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-950">Keep control</div>
                      <div className="mt-1 font-medium text-slate-600">Review cleanup sections and select what runs.</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full mx-auto">
                  <Button
                    size="lg"
                    onClick={onStart}
                    icon={MainIcon}
                    iconPosition="left"
                    className="rounded-full bg-blue-500 shadow-[0_18px_40px_rgba(59,130,246,0.24)] hover:bg-blue-600 hover:shadow-[0_22px_52px_rgba(59,130,246,0.30)] focus-visible:ring-blue-500"
                  >
                    {config.buttonText}
                  </Button>

                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              {config.items.map((item, index) => {
                const ItemIcon = getIcon(item.icon);
                return (
                  <Card key={index} className={myMacActionCard}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_25%,rgba(59,130,246,0.14),transparent_42%)]" />
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-blue-200/70 bg-blue-100/35 shadow-[0_12px_36px_rgba(59,130,246,0.16)] backdrop-blur-xl">
                      {ItemIcon && (
                        <ItemIcon className="h-7 w-7 text-blue-500 transition-transform duration-300 group-hover:scale-110" />
                      )}
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm font-medium leading-5 text-slate-600">{item.description}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'uninstall' || variant === 'feature') {
    return (
      <div
        className="relative h-full min-h-0 overflow-hidden"
        style={{
          backgroundImage: `radial-gradient(circle at 78% 34%, ${featureTheme.glow}, transparent 34%), radial-gradient(circle at 45% 78%, rgba(109,93,252,0.12), transparent 44%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-20 top-20 h-[520px] w-[520px] rounded-full border border-white/45 opacity-70" />
        <div className="pointer-events-none absolute -right-10 top-28 h-[450px] w-[450px] rounded-full border border-white/40 opacity-65" />
        <div className="pointer-events-none absolute bottom-[-260px] right-[-20px] h-[520px] w-[760px] rounded-[50%] border border-white/45 opacity-65" />
        <div className="pointer-events-none absolute left-1/2 top-[15%] text-4xl font-light text-white/85">+</div>
        <div className="pointer-events-none absolute right-[9%] top-[9%] text-4xl font-light text-white/85">+</div>
        <div className="pointer-events-none absolute right-[4%] top-[20%] text-3xl font-light text-white/75">+</div>
        <div className="pointer-events-none absolute right-[18%] top-[27%] h-2 w-2 rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.9)]" />
        <div className="pointer-events-none absolute left-[48%] top-[25%] h-2 w-2 rounded-full bg-white/75" />

        <div className="relative mx-auto grid h-full max-w-[1540px] grid-cols-[minmax(360px,0.9fr)_minmax(360px,1.1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-10 px-[5.5%] pb-8 pt-[clamp(5.25rem,9vh,7rem)]">
          <section className="min-w-0">
            <h1 className="text-[clamp(3.25rem,4.2vw,4.45rem)] font-black leading-[0.92] tracking-[-0.06em] text-slate-950 drop-shadow-[0_3px_0_rgba(255,255,255,0.85)]">
              {config.title}
            </h1>
            <p className="mt-[clamp(1.25rem,3vh,2.25rem)] max-w-[29rem] text-[clamp(1.05rem,1.25vw,1.28rem)] font-medium leading-[1.58] tracking-[-0.035em] text-slate-600">
              {config.description}
            </p>

            <div className="mt-[clamp(1.5rem,4vh,3rem)] max-w-[34rem] divide-y divide-slate-300/45 border-y border-slate-300/45">
              {config.items.map((item, index) => {
                const ItemIcon = getIcon(item.icon);
                return (
                  <div key={index} className="flex items-center gap-[clamp(1.1rem,2.1vw,1.75rem)] py-[clamp(0.85rem,2vh,1.65rem)]">
                    <div className="flex h-[clamp(3.25rem,4.2vw,4.25rem)] w-[clamp(3.25rem,4.2vw,4.25rem)] shrink-0 items-center justify-center rounded-[1.1rem] border border-white/70 bg-white/35 shadow-[0_14px_34px_rgba(78,79,110,0.10),inset_0_1px_1px_rgba(255,255,255,0.75)] backdrop-blur-xl">
                      {ItemIcon && <ItemIcon className="h-[clamp(1.55rem,2.3vw,2rem)] w-[clamp(1.55rem,2.3vw,2rem)]" style={{ color: featureTheme.accent }} strokeWidth={1.9} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[clamp(1.05rem,1.35vw,1.35rem)] font-black leading-none tracking-[-0.04em] text-slate-950">{item.title}</h3>
                      <p className="mt-[clamp(0.45rem,1vh,0.75rem)] text-[clamp(0.85rem,1vw,1rem)] font-medium leading-[1.22] tracking-[-0.035em] text-slate-500">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="relative flex min-h-0 items-center justify-center overflow-hidden pb-[clamp(1rem,3vh,2.5rem)]">
            <div className="absolute bottom-[14%] h-20 w-[min(410px,42vw)] rounded-[50%] bg-white/35 shadow-[0_30px_70px_rgba(255,80,110,0.18),inset_0_1px_1px_rgba(255,255,255,0.65)] backdrop-blur-xl" />
            <div className="absolute bottom-[11%] h-20 w-[min(500px,50vw)] rounded-[50%] border border-white/35" />
            {featureImage ? (
              <img
                src={featureImage}
                alt=""
                className="relative z-10 w-[clamp(18rem,30vw,28rem)] object-contain"
                style={{ filter: `drop-shadow(0 24px 54px ${featureTheme.glow})` }}
                draggable={false}
                aria-hidden="true"
              />
            ) : (
              MainIcon && (
                <MainIcon
                  className="relative z-10 h-[clamp(11rem,18.6vw,17.35rem)] w-[clamp(11rem,18.6vw,17.35rem)]"
                  style={{
                    color: featureTheme.accent,
                    filter: `drop-shadow(0 24px 54px ${featureTheme.glow})`,
                  }}
                  strokeWidth={1.18}
                  aria-hidden="true"
                />
              )
            )}
          </section>

          <div className="relative col-span-2 flex flex-col items-center gap-[clamp(0.7rem,1.6vh,1.15rem)] pt-[clamp(1rem,2.2vh,2rem)] text-center">
            <img
              src="./assets/images/start-here-bg.png"
              alt="Start here"
              className="absolute -top-[clamp(3rem,5.8vh,4.6rem)] left-[clamp(2rem,6vw,6rem)] w-[clamp(8.75rem,14vw,13rem)] object-contain"
              draggable={false}
            />
            <Button
              size="lg"
              onClick={onStart}
              icon={MainIcon}
              iconPosition="left"
              className="h-[clamp(3.8rem,6vh,5rem)] min-w-[clamp(20rem,28vw,26rem)] rounded-[1.85rem] bg-[#6d4dfc] px-12 text-[clamp(1.25rem,1.65vw,1.65rem)] font-bold tracking-[-0.04em] shadow-[0_18px_34px_rgba(83,58,220,0.34)] hover:bg-[#5d3ff0]"
            >
              {config.buttonText}
            </Button>
            <div className="flex items-center gap-3 text-[clamp(0.8rem,1vw,0.98rem)] font-semibold tracking-[-0.035em] text-slate-500">
              <Icons.LockKeyhole className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              {featureTheme.footerText}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center">
      {/* Centered content with max-width */}
      <div className="flex-1 w-full max-w-[850px] mx-auto grid grid-cols-2 gap-12 p-12">
        {/* Left side - Info */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-text-primary mb-4">{config.title}</h1>
          <p className="text-lg text-text-secondary mb-8">{config.description}</p>

          <div className="space-y-4">
            {config.items.map((item, index) => {
              const ItemIcon = getIcon(item.icon);
              return (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center transition-transform duration-200 hover:scale-110">
                    {ItemIcon && (
                      <ItemIcon
                        className="w-5 h-5"
                        style={{ color: iconStyle.color }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">{item.title}</h3>
                    <p className="text-sm text-text-secondary">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side - Visual */}
        <div className="flex items-center justify-center">
          <div className="relative">
            {MainIcon && (
              <MainIcon
                className={`w-64 h-64 ${iconStyle.animation}`}
                style={{
                  color: iconStyle.color,
                  strokeWidth: 1.5,
                  filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.12))'
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-8 flex justify-center w-full max-w-[850px] mx-auto">
        <Button
          size="lg"
          onClick={onStart}
          icon={MainIcon}
          iconPosition="left"
          className="rounded-full"
        >
          {config.buttonText}
        </Button>
      </div>
    </div>
  );
}
