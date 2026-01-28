import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type StateValue =
  | string
  | string[]
  | Record<string, string>
  | number
  | boolean
  | null
  | undefined;

interface UseQueryStateOptions {
  debounceMs?: number;
}

/**
 * Custom hook that syncs React state with URL query parameters.
 *
 * Features:
 * - Reads initial state from URL on mount
 * - Updates URL when state changes (with debouncing to prevent excessive URL updates)
 * - Handles arrays and objects by serializing them as JSON
 * - Cleans up empty/null values from URL
 *
 * @param key - The query parameter key
 * @param initialValue - The initial value if not found in URL
 * @param options - Configuration options (debounceMs for URL update delay)
 * @returns [value, setValue] - Similar to useState
 */
export function useQueryState<T extends StateValue>(
  key: string,
  initialValue: T,
  options: UseQueryStateOptions = { debounceMs: 300 },
): [T, (value: T | ((prev: T) => T)) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<T>(() => {
    // Initialize from URL
    const params = new URLSearchParams(location.search);
    const value = params.get(key);

    if (value === null) {
      return initialValue;
    }

    try {
      // Try to parse as JSON (for arrays and objects)
      if (value.startsWith("[") || value.startsWith("{")) {
        return JSON.parse(value) as T;
      }
      // Return as string for string values
      return value as T;
    } catch {
      return value as T;
    }
  });

  // Debounced update to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.search);

      // Handle different types of values
      if (
        state === null ||
        state === undefined ||
        state === "" ||
        (Array.isArray(state) && state.length === 0) ||
        (typeof state === "object" &&
          !Array.isArray(state) &&
          Object.keys(state).length === 0)
      ) {
        // Remove parameter if empty
        params.delete(key);
      } else if (typeof state === "object") {
        // Serialize arrays and objects to JSON
        params.set(key, JSON.stringify(state));
      } else {
        // Set string, number, or boolean values
        params.set(key, String(state));
      }

      const newSearch = params.toString();
      const newUrl = newSearch ? `?${newSearch}` : location.pathname;

      // Only navigate if the URL actually changed
      if (newUrl !== `${location.pathname}${location.search}`) {
        navigate(
          { pathname: location.pathname, search: newSearch },
          { replace: true },
        );
      }
    }, options.debounceMs);

    return () => clearTimeout(timer);
  }, [
    state,
    key,
    location.pathname,
    location.search,
    navigate,
    options.debounceMs,
  ]);

  const setStateValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) =>
      typeof value === "function" ? (value as (prev: T) => T)(prev) : value,
    );
  }, []);

  return [state, setStateValue];
}

/**
 * Utility function to sync multiple query state values at once.
 * Returns an object with synchronized state for each key.
 */
export function useQueryStates<T extends Record<string, StateValue>>(
  initialValues: T,
  options: UseQueryStateOptions = { debounceMs: 300 },
): [T, (key: keyof T, value: StateValue) => void] {
  const location = useLocation();
  const navigate = useNavigate();

  const [state, setState] = useState<T>(() => {
    const params = new URLSearchParams(location.search);
    const result = { ...initialValues };

    for (const key of Object.keys(initialValues)) {
      const value = params.get(key);
      if (value !== null) {
        try {
          if (value.startsWith("[") || value.startsWith("{")) {
            result[key as keyof T] = JSON.parse(value);
          } else {
            result[key as keyof T] = value as any;
          }
        } catch {
          result[key as keyof T] = value as any;
        }
      }
    }

    return result;
  });

  // Debounced update to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(location.search);

      for (const [key, value] of Object.entries(state)) {
        if (
          value === null ||
          value === undefined ||
          value === "" ||
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === "object" &&
            !Array.isArray(value) &&
            Object.keys(value).length === 0)
        ) {
          params.delete(key);
        } else if (typeof value === "object") {
          params.set(key, JSON.stringify(value));
        } else {
          params.set(key, String(value));
        }
      }

      const newSearch = params.toString();
      const newUrl = newSearch ? `?${newSearch}` : location.pathname;

      if (newUrl !== `${location.pathname}${location.search}`) {
        navigate(
          { pathname: location.pathname, search: newSearch },
          { replace: true },
        );
      }
    }, options.debounceMs);

    return () => clearTimeout(timer);
  }, [state, location.pathname, location.search, navigate, options.debounceMs]);

  const setStateValue = useCallback(
    (key: keyof T, value: StateValue | ((prev: any) => StateValue)) => {
      setState((prev) => {
        const newValue =
          typeof value === "function"
            ? (value as (prev: any) => StateValue)(prev[key])
            : value;
        return {
          ...prev,
          [key]: newValue,
        };
      });
    },
    [],
  );

  return [state, setStateValue];
}
