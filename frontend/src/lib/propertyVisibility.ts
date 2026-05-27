import type { PropertyDefinition } from "../types";

export function isPropertyVisibleForType(
  property: PropertyDefinition,
  factsheetTypeId?: string,
): boolean {
  const allowedTypeIds = property.factsheet_types ?? [];

  if (allowedTypeIds.length === 0) {
    return true;
  }

  if (!factsheetTypeId) {
    return false;
  }

  return allowedTypeIds.includes(factsheetTypeId);
}

export function filterPropertiesForType(
  properties: PropertyDefinition[],
  factsheetTypeId?: string,
): PropertyDefinition[] {
  return properties.filter((property) =>
    isPropertyVisibleForType(property, factsheetTypeId),
  );
}
