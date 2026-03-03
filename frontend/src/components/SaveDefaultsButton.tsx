import { useState } from "react";
import { Save, CheckCircle } from "lucide-react";
import { Button } from "./ui";
import type {
  FactsheetFilters,
  DependenciesFilters,
  MatrixFilters,
  SpiderFilters,
  ScatterFilters,
} from "../hooks/useAppSettings";

type FilterType =
  | "factsheet"
  | "dependencies"
  | "matrix"
  | "spider"
  | "scatter";

interface SaveDefaultsButtonProps {
  type: FilterType;
  filters: Record<string, unknown>;
  onSave: (
    filters:
      | FactsheetFilters
      | DependenciesFilters
      | MatrixFilters
      | SpiderFilters
      | ScatterFilters,
  ) => void;
  disabled?: boolean;
}

export function SaveDefaultsButton({
  type,
  filters,
  onSave,
  disabled = false,
}: SaveDefaultsButtonProps) {
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Remove propertyFilters if empty
    const filtersToSave = { ...filters };
    if (
      filtersToSave.propertyFilters !== null &&
      typeof filtersToSave.propertyFilters === "object" &&
      Object.keys(filtersToSave.propertyFilters as object).length === 0
    ) {
      delete filtersToSave.propertyFilters;
    }
    if (
      Array.isArray(filtersToSave.displayProperties) &&
      filtersToSave.displayProperties.length === 0
    ) {
      delete filtersToSave.displayProperties;
    }

    onSave(filtersToSave as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const getLabel = () => {
    switch (type) {
      case "factsheet":
        return "Save as Factsheet Default";
      case "dependencies":
        return "Save as Dependencies Default";
      case "matrix":
        return "Save as Matrix View Default";
      case "spider":
        return "Save as Spider Diagram Default";
      case "scatter":
        return "Save as Scatter Plot Default";
    }
  };

  return (
    <Button
      variant={saved ? "primary" : "secondary"}
      size="sm"
      onClick={handleSave}
      disabled={disabled}
      icon={
        saved ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )
      }
    >
      {saved ? "Saved!" : getLabel()}
    </Button>
  );
}
