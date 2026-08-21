import { useCallback, useEffect, useRef, useState } from 'react';
import type { AutomationMutationResult, AutomationRecipeInput, AutomationsState } from '@/types';

const EMPTY_STATE: AutomationsState = {
  version: 1,
  paused: false,
  recipes: [],
  runs: [],
  allowlist: { cleanSections: [], actionKinds: [] },
  scheduler: { running: false, active: false },
};

// Wraps the mole:automations:* IPC surface. Every mutation handler in the main
// process returns the freshly normalized state, so the hook simply adopts what
// it is given rather than predicting the result locally. That keeps the UI from
// ever showing a recipe as enabled when the main process refused to enable it.
export function useAutomations() {
  const [state, setState] = useState<AutomationsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [busyRecipeId, setBusyRecipeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const api = window.moleDesktop?.automations;
    if (!api) {
      setLoading(false);
      return;
    }

    try {
      const next = await api.list();
      if (mountedRef.current && next) setState(next);
    } catch (refreshError) {
      if (mountedRef.current) setError((refreshError as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const api = window.moleDesktop?.automations;
    api?.onChanged(() => void refresh());

    return () => {
      api?.removeListeners();
    };
  }, [refresh]);

  const applyResult = useCallback((result: AutomationMutationResult | undefined) => {
    if (!result) return false;
    if (result.state) setState(result.state);
    setError(result.ok ? null : result.message || 'Action failed');
    return result.ok;
  }, []);

  const runMutation = useCallback(
    async (recipeId: string | null, mutate: () => Promise<AutomationMutationResult>) => {
      setBusyRecipeId(recipeId);
      try {
        return applyResult(await mutate());
      } catch (mutationError) {
        setError((mutationError as Error).message);
        return false;
      } finally {
        if (mountedRef.current) setBusyRecipeId(null);
      }
    },
    [applyResult],
  );

  const saveRecipe = useCallback(
    (recipe: AutomationRecipeInput) => runMutation(recipe.id ?? null, () => window.moleDesktop.automations!.saveRecipe(recipe)),
    [runMutation],
  );

  const deleteRecipe = useCallback(
    (recipeId: string) => runMutation(recipeId, () => window.moleDesktop.automations!.deleteRecipe(recipeId)),
    [runMutation],
  );

  const setEnabled = useCallback(
    (recipeId: string, enabled: boolean) => runMutation(recipeId, () => window.moleDesktop.automations!.setEnabled(recipeId, enabled)),
    [runMutation],
  );

  const setPaused = useCallback(
    (paused: boolean) => runMutation(null, () => window.moleDesktop.automations!.setPaused(paused)),
    [runMutation],
  );

  const dryRun = useCallback(
    (recipeId: string) => runMutation(recipeId, () => window.moleDesktop.automations!.dryRun(recipeId)),
    [runMutation],
  );

  const runNow = useCallback(
    (recipeId: string) => runMutation(recipeId, () => window.moleDesktop.automations!.runNow(recipeId)),
    [runMutation],
  );

  const cancel = useCallback(async () => {
    await window.moleDesktop?.automations?.cancel();
    await refresh();
  }, [refresh]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    state,
    loading,
    busyRecipeId,
    error,
    refresh,
    saveRecipe,
    deleteRecipe,
    setEnabled,
    setPaused,
    dryRun,
    runNow,
    cancel,
    dismissError,
  };
}
