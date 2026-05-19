import { useState } from 'react';

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return initialValue;

      const parsed = JSON.parse(stored) as unknown;
      return !validate || validate(parsed) ? (parsed as T) : initialValue;
    } catch (error) {
      console.error(`Failed to read ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  const setPersistentValue: typeof setValue = (nextValue) => {
    setValue((previousValue) => {
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (previous: T) => T)(previousValue)
          : nextValue;

      try {
        localStorage.setItem(key, JSON.stringify(resolvedValue));
      } catch (error) {
        console.error(`Failed to write ${key} to localStorage:`, error);
      }

      return resolvedValue;
    });
  };

  return [value, setPersistentValue] as const;
}
