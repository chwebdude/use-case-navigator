import type { FactsheetType, StatusDefinition } from "../types";

export const DEFAULT_STATUSES: StatusDefinition[] = [
  { id: "draft", label: "Draft", color: "#6b7280" },
  { id: "active", label: "Active", color: "#16a34a" },
  { id: "archived", label: "Archived", color: "#d97706" },
];

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function isStatusDefinition(value: unknown): value is StatusDefinition {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StatusDefinition>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.label === "string" &&
    candidate.label.trim().length > 0 &&
    typeof candidate.color === "string"
  );
}

export function normalizeStatuses(value: unknown): StatusDefinition[] {
  if (!Array.isArray(value)) {
    return DEFAULT_STATUSES;
  }

  const seen = new Set<string>();
  const normalized = value
    .filter(isStatusDefinition)
    .map((status) => ({
      id: status.id.trim(),
      label: status.label.trim(),
      color: HEX_COLOR_RE.test(status.color.trim())
        ? status.color.trim()
        : "#6b7280",
    }))
    .filter((status) => {
      if (seen.has(status.id)) return false;
      seen.add(status.id);
      return true;
    });

  return normalized.length > 0 ? normalized : DEFAULT_STATUSES;
}

export function getStatusesForType(
  globalStatuses: StatusDefinition[] | undefined,
  factsheetType?: FactsheetType,
): StatusDefinition[] {
  if (factsheetType?.status_overrides && factsheetType.status_overrides.length) {
    return normalizeStatuses(factsheetType.status_overrides);
  }
  return normalizeStatuses(globalStatuses);
}

export function getStatusMeta(
  statusId: string,
  globalStatuses: StatusDefinition[] | undefined,
  factsheetType?: FactsheetType,
): StatusDefinition {
  const statuses = getStatusesForType(globalStatuses, factsheetType);
  const exact = statuses.find((s) => s.id === statusId);
  if (exact) return exact;

  const globalExact = normalizeStatuses(globalStatuses).find((s) => s.id === statusId);
  if (globalExact) return globalExact;

  return {
    id: statusId || "unknown",
    label: "Unknown",
    color: "#6b7280",
  };
}

export function getStatusSelectOptions(
  globalStatuses: StatusDefinition[] | undefined,
  factsheetType?: FactsheetType,
): Array<{ value: string; label: string }> {
  return getStatusesForType(globalStatuses, factsheetType).map((status) => ({
    value: status.id,
    label: status.label,
  }));
}

export function getStatusTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const fullHex = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}
