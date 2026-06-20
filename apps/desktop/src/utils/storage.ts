// Storage utility using Electron for app-wide state and localStorage as a browser/test fallback.

import type { MyMacMetricsCache } from '@/types';

const MY_MAC_METRICS = 'mole-my-mac-metrics';

export async function getMyMacMetrics(): Promise<MyMacMetricsCache | null> {
  if (window.moleDesktop?.myMacCache) {
    const cache = await window.moleDesktop.myMacCache.get();
    if (cache) return cache;
  }

  try {
    const data = localStorage.getItem(MY_MAC_METRICS);
    if (!data) return null;
    const parsed = JSON.parse(data) as MyMacMetricsCache;
    if (!parsed.metrics || typeof parsed.timestamp !== 'number') return null;
    return parsed;
  } catch (error) {
    console.error('Failed to read MyMac metrics from localStorage:', error);
    return null;
  }
}

export async function setMyMacMetrics(metrics: string, history: string, batteryHistory: string): Promise<void> {
  if (window.moleDesktop?.myMacCache) {
    const result = await window.moleDesktop.myMacCache.set({ metrics, history, batteryHistory });
    if (result.ok) return;
    console.error('Failed to write MyMac metrics to desktop cache:', result.message);
  }

  try {
    localStorage.setItem(MY_MAC_METRICS, JSON.stringify({
      metrics,
      history,
      batteryHistory,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to write MyMac metrics to localStorage:', error);
  }
}
