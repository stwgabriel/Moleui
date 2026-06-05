import type { PageId } from '@/types';

export type AccentPageId = Exclude<PageId, 'home'>;

export interface FeatureAccent {
  accent: string;
  accentHover: string;
  rgb: string;
  glow: string;
}

export const FEATURE_ACCENTS: Record<AccentPageId, FeatureAccent> = {
  mymac: {
    accent: '#10b981',
    accentHover: '#059669',
    rgb: '16,185,129',
    glow: 'rgba(16,185,129,0.22)',
  },
  clean: {
    accent: '#2973fd',
    accentHover: '#1d5fe4',
    rgb: '41,115,253',
    glow: 'rgba(41,115,253,0.24)',
  },
  optimize: {
    accent: '#8c3ffc',
    accentHover: '#7730e5',
    rgb: '140,63,252',
    glow: 'rgba(140,63,252,0.25)',
  },
  uninstall: {
    accent: '#fc3638',
    accentHover: '#e0282b',
    rgb: '252,54,56',
    glow: 'rgba(252,54,56,0.25)',
  },
  analyze: {
    accent: '#fd2d86',
    accentHover: '#e51c73',
    rgb: '253,45,134',
    glow: 'rgba(253,45,134,0.24)',
  },
};

export const FEATURE_ACCENTS_BY_ICON: Record<string, FeatureAccent> = {
  Activity: FEATURE_ACCENTS.mymac,
  Sparkles: FEATURE_ACCENTS.clean,
  Trash2: FEATURE_ACCENTS.clean,
  Gauge: FEATURE_ACCENTS.optimize,
  Zap: FEATURE_ACCENTS.optimize,
  PackageX: FEATURE_ACCENTS.uninstall,
  Database: FEATURE_ACCENTS.analyze,
  PieChart: FEATURE_ACCENTS.analyze,
};
