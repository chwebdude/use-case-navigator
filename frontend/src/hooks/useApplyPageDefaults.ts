import { useEffect, useRef } from "react";

/**
 * Applies saved default filter values to page state once app settings have loaded,
 * but only when no relevant URL query parameters are already present.
 *
 * @param defaults - The default filter object from useAppSettings (e.g. settings.defaultFactsheetFilters)
 * @param setState - The setState function from useQueryStates
 * @param settingsLoading - The loading flag from useAppSettings
 */
export function useApplyPageDefaults(
  // Use object instead of Record<string,unknown> since filter interfaces lack an index signature
  defaults: object | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setState: (key: any, value: any) => void,
  settingsLoading: boolean,
): void {
  const applied = useRef(false);

  useEffect(() => {
    if (settingsLoading || applied.current) return;
    applied.current = true;

    if (!defaults) return;

    // Apply each key individually — skip only keys that are already present in the URL.
    // This avoids the case where a default like axisMode="metrics" gets written to the URL
    // (via the debounced useQueryStates sync) before settings load, which would otherwise
    // prevent selectedMetrics and other keys from being applied at all.
    const params = new URLSearchParams(window.location.search);
    const entries = Object.entries(defaults as Record<string, unknown>);

    for (const [key, value] of entries) {
      if (value !== undefined && value !== null && value !== "") {
        if (!params.has(key)) {
          setState(key, value);
        }
      }
    }
  }, [settingsLoading]); // intentionally omit defaults/setState – we only want this to run once after load
}
