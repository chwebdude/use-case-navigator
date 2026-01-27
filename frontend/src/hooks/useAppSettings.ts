import { useState, useEffect, useCallback } from "react";
import type { RecordModel, RecordSubscription } from "pocketbase";
import pb from "../lib/pocketbase";

export const AVAILABLE_ICONS = [
  { id: "Cpu", label: "CPU" },
  { id: "Brain", label: "Brain" },
  { id: "Lightbulb", label: "Lightbulb" },
  { id: "Rocket", label: "Rocket" },
  { id: "Zap", label: "Zap" },
  { id: "Target", label: "Target" },
  { id: "Compass", label: "Compass" },
  { id: "Map", label: "Map" },
  { id: "Globe", label: "Globe" },
  { id: "Database", label: "Database" },
  { id: "Server", label: "Server" },
  { id: "Code", label: "Code" },
] as const;

export type IconId = (typeof AVAILABLE_ICONS)[number]["id"];

interface AppSettings {
  title: string;
  icon: IconId;
  maxMetricWeight: number;
}

interface AppSettingsRecord extends RecordModel {
  title: string;
  icon: IconId;
  maxMetricWeight?: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  title: "Use Case Navigator",
  icon: "Cpu",
  maxMetricWeight: 10,
};

export function useAppSettings() {
  const [record, setRecord] = useState<AppSettingsRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const settings: AppSettings = record
    ? {
        title: record.title,
        icon: record.icon,
        maxMetricWeight:
          record.maxMetricWeight ?? DEFAULT_SETTINGS.maxMetricWeight,
      }
    : DEFAULT_SETTINGS;

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const records = await pb
        .collection("app_settings")
        .getFullList<AppSettingsRecord>();
      if (records.length > 0) {
        setRecord(records[0]);
      }
    } catch (err) {
      console.error("Failed to fetch app settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Subscribe to real-time updates
    let unsubscribe: (() => void) | undefined;

    pb.collection("app_settings")
      .subscribe<AppSettingsRecord>(
        "*",
        (event: RecordSubscription<AppSettingsRecord>) => {
          if (event.action === "update" || event.action === "create") {
            setRecord(event.record);
          }
        },
      )
      .then((unsub) => {
        unsubscribe = unsub;
      });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchSettings]);

  // Update document title when settings change
  useEffect(() => {
    document.title = settings.title;
  }, [settings.title]);

  // Update favicon when icon changes
  useEffect(() => {
    updateFavicon(settings.icon);
  }, [settings.icon]);

  const setSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      if (!record) return;

      try {
        await pb.collection("app_settings").update(record.id, newSettings);
      } catch (err) {
        console.error("Failed to update app settings:", err);
      }
    },
    [record],
  );

  const resetSettings = useCallback(async () => {
    if (!record) return;

    try {
      await pb.collection("app_settings").update(record.id, DEFAULT_SETTINGS);
    } catch (err) {
      console.error("Failed to reset app settings:", err);
    }
  }, [record]);

  return {
    settings,
    setSettings,
    resetSettings,
    defaultSettings: DEFAULT_SETTINGS,
    loading,
  };
}

// Generate an SVG favicon from the icon
function updateFavicon(iconId: IconId) {
  const svgPaths: Record<IconId, string> = {
    Cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
    Brain:
      '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M12 5v14"/>',
    Lightbulb:
      '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    Rocket:
      '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    Zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    Target:
      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    Compass:
      '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    Map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
    Globe:
      '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    Database:
      '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    Server:
      '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    Code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  };

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="24" height="24" fill="#00aeef" rx="4"/>
      <g transform="translate(2, 2) scale(0.83)">
        ${svgPaths[iconId]}
      </g>
    </svg>
  `;

  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = url;
}
