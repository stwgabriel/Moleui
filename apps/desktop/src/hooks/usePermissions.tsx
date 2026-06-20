import { useCallback, useEffect, useState } from 'react';
import type { PermissionPane, PermissionPrefs, PermissionStatus } from '@/types';

interface PermissionsState {
  fullDiskAccess: PermissionStatus;
  onboarded: boolean;
  systemCleanupEnabled: boolean;
  loading: boolean;
}

const INITIAL: PermissionsState = {
  fullDiskAccess: 'unknown',
  // Assume onboarded until prefs load so the onboarding modal never flashes.
  onboarded: true,
  systemCleanupEnabled: true,
  loading: true,
};

// Reads macOS permission status + persisted app prefs and exposes actions to
// re-check, open System Settings, trigger the Files-&-Folders prompt, and update
// prefs. Self-contained so both the main app and the Settings window can use it.
export function usePermissions() {
  const [state, setState] = useState<PermissionsState>(INITIAL);

  const refresh = useCallback(async () => {
    const api = window.moleDesktop?.permissions;
    if (!api) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const [status, prefs] = await Promise.all([api.status(), api.getPrefs()]);
      setState({
        fullDiskAccess: status.fullDiskAccess,
        onboarded: prefs.onboarded,
        systemCleanupEnabled: prefs.systemCleanupEnabled,
        loading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPrefs = useCallback(async (prefs: Partial<PermissionPrefs>) => {
    const api = window.moleDesktop?.permissions;
    if (!api) return;
    const merged = await api.setPrefs(prefs);
    setState((prev) => ({ ...prev, onboarded: merged.onboarded, systemCleanupEnabled: merged.systemCleanupEnabled }));
  }, []);

  const openSettings = useCallback((pane?: PermissionPane) => {
    void window.moleDesktop?.permissions?.openSettings(pane);
  }, []);

  const requestFiles = useCallback(async () => {
    await window.moleDesktop?.permissions?.requestFiles();
    await refresh();
  }, [refresh]);

  return { ...state, refresh, setPrefs, openSettings, requestFiles };
}
