// Storage utility using localStorage for persisting app state
// localStorage is simpler and more reliable than IndexedDB for this use case

const HAS_SEEN_HOME_PAGE = 'mole-has-seen-home-page';
const PREFERRED_PAGE = 'mole-preferred-page';
const MY_MAC_METRICS = 'mole-my-mac-metrics';

export interface MyMacMetricsCache {
  metrics: string;
  history?: string;
  batteryHistory?: string;
  cpuHistory?: string;
  memoryHistory?: string;
  timestamp: number;
}

export async function hasSeenHomePage(): Promise<boolean> {
  try {
    return localStorage.getItem(HAS_SEEN_HOME_PAGE) === 'true';
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return false;
  }
}

export async function markHomePageSeen(): Promise<void> {
  try {
    localStorage.setItem(HAS_SEEN_HOME_PAGE, 'true');
  } catch (error) {
    console.error('Failed to write to localStorage:', error);
  }
}

export async function getPreferredPage(): Promise<string | null> {
  try {
    return localStorage.getItem(PREFERRED_PAGE);
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return null;
  }
}

export async function setPreferredPage(page: string): Promise<void> {
  try {
    localStorage.setItem(PREFERRED_PAGE, page);
  } catch (error) {
    console.error('Failed to write to localStorage:', error);
  }
}

export async function getMyMacMetrics(): Promise<MyMacMetricsCache | null> {
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
