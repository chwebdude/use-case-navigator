import type { Dependency } from "../types";

export type DependencyRelationMode =
  | "chain"
  | "connected"
  | "upstream"
  | "downstream"
  | "direct";

export function getRelatedFactsheetIds(
  factsheetId: string,
  dependencies: Dependency[],
  mode: DependencyRelationMode,
): Set<string> {
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();
  for (const dependency of dependencies) {
    downstream.set(dependency.factsheet, [
      ...(downstream.get(dependency.factsheet) ?? []),
      dependency.depends_on,
    ]);
    upstream.set(dependency.depends_on, [
      ...(upstream.get(dependency.depends_on) ?? []),
      dependency.factsheet,
    ]);
  }

  const related = new Set([factsheetId]);
  const traverse = (directions: Map<string, string[]>[]): void => {
    const visited = new Set([factsheetId]);
    const pending = [factsheetId];
    while (pending.length > 0) {
      const current = pending.pop()!;
      for (const direction of directions) {
        for (const neighbor of direction.get(current) ?? []) {
          related.add(neighbor);
          if (!visited.has(neighbor) && mode !== "direct") {
            visited.add(neighbor);
            pending.push(neighbor);
          }
        }
      }
    }
  };

  if (mode === "connected" || mode === "direct") {
    traverse([downstream, upstream]);
  } else {
    if (mode !== "upstream") traverse([downstream]);
    if (mode !== "downstream") traverse([upstream]);
  }
  return related;
}