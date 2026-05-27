import { useState, useEffect } from "react";
import { Sparkles, Check, Loader2, AlertCircle } from "lucide-react";
import { Card } from "./ui";
import { Button } from "./ui";
import type { AiDraft } from "../hooks/useAiDraft";
import type { PropertyDefinition, PropertyOption } from "../types";

interface AiDraftPanelProps {
  draft: AiDraft | null;
  loading: boolean;
  error: string | null;
  propertyDefinitions: PropertyDefinition[];
  propertyOptions: PropertyOption[];
  hiddenFields: string[];
  onApply: (draft: AiDraft) => void;
}

export default function AiDraftPanel({
  draft,
  loading,
  error,
  propertyDefinitions,
  propertyOptions,
  hiddenFields,
  onApply,
}: AiDraftPanelProps) {
  // Track which fields/properties are selected for applying
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Reset selections whenever a new draft arrives
  useEffect(() => {
    if (!draft) {
      setSelected({});
      return;
    }
    const initial: Record<string, boolean> = {};
    if (draft.name) initial["name"] = true;
    for (const key of [
      "description",
      "responsibility",
      "benefits",
      "what_it_does",
      "problems_addressed",
      "potential_ui",
    ] as const) {
      if (draft[key]) initial[key] = true;
    }
    for (const [propId, optId] of Object.entries(draft.properties)) {
      if (optId) initial[`prop:${propId}`] = true;
    }
    setSelected(initial);
  }, [draft]);

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    if (!draft) return;
    const filtered: AiDraft = {
      name: selected["name"] ? draft.name : "",
      description: selected["description"] ? draft.description : "",
      responsibility: selected["responsibility"] ? draft.responsibility : "",
      benefits: selected["benefits"] ? draft.benefits : "",
      what_it_does: selected["what_it_does"] ? draft.what_it_does : "",
      problems_addressed: selected["problems_addressed"]
        ? draft.problems_addressed
        : "",
      potential_ui: selected["potential_ui"] ? draft.potential_ui : "",
      properties: {},
    };
    for (const [propId, optId] of Object.entries(draft.properties)) {
      filtered.properties[propId] = selected[`prop:${propId}`] ? optId : "";
    }
    onApply(filtered);
  };
  const getOptionValue = (optionId: string): string => {
    const opt = propertyOptions.find((o) => o.id === optionId);
    return opt?.value || "";
  };

  const getPropertyName = (propId: string): string => {
    const pd = propertyDefinitions.find((p) => p.id === propId);
    return pd?.name || propId;
  };

  if (loading) {
    return (
      <Card className="sticky top-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent-500" />
          <h3 className="text-lg font-semibold text-primary-900">AI Draft</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <p className="text-sm">Generating draft...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="sticky top-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent-500" />
          <h3 className="text-lg font-semibold text-primary-900">AI Draft</h3>
        </div>
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  if (!draft) {
    return (
      <Card className="sticky top-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-accent-500" />
          <h3 className="text-lg font-semibold text-primary-900">AI Draft</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-8">
          Enter a name or description and click out of the field to generate an
          AI-powered draft.
        </p>
      </Card>
    );
  }

  const fields: { key: keyof AiDraft; label: string }[] = [
    { key: "description", label: "Description" },
    { key: "responsibility", label: "Responsibility" },
    { key: "benefits", label: "Benefits" },
    { key: "what_it_does", label: "What it does" },
    { key: "problems_addressed", label: "Problems addressed" },
    { key: "potential_ui", label: "Potential User Interface" },
  ];

  const visibleFields = fields.filter(
    (f) => !hiddenFields.includes(f.key as string) && draft[f.key],
  );

  const propertyEntries = Object.entries(draft.properties).filter(
    ([, optId]) => optId,
  );

  return (
    <Card className="sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-500" />
          <h3 className="text-lg font-semibold text-primary-900">AI Draft</h3>
        </div>
        <Button
          size="sm"
          onClick={handleApply}
          icon={<Check className="w-4 h-4" />}
        >
          Apply Selected
        </Button>
      </div>

      <div className="space-y-3">
        {draft.name && (
          <label className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={!!selected["name"]}
              onChange={() => toggle("name")}
              className="mt-1 accent-accent-500"
            />
            <div className={selected["name"] ? "" : "opacity-40"}>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                Suggested Name
              </h4>
              <p className="text-sm font-medium text-primary-900">
                {draft.name}
              </p>
            </div>
          </label>
        )}

        {visibleFields.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-start gap-2 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={!!selected[key]}
              onChange={() => toggle(key)}
              className="mt-1 accent-accent-500"
            />
            <div className={selected[key] ? "" : "opacity-40"}>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">
                {label}
              </h4>
              <p className="text-sm text-primary-800 whitespace-pre-wrap">
                {draft[key] as string}
              </p>
            </div>
          </label>
        ))}

        {propertyEntries.length > 0 && (
          <div className="border-t border-gray-200 pt-3">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Suggested Properties
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {propertyEntries.map(([propId, optId]) => (
                <label
                  key={propId}
                  className="flex items-start gap-2 cursor-pointer bg-gray-50 px-3 py-2 border border-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[`prop:${propId}`]}
                    onChange={() => toggle(`prop:${propId}`)}
                    className="mt-0.5 accent-accent-500"
                  />
                  <div
                    className={selected[`prop:${propId}`] ? "" : "opacity-40"}
                  >
                    <span className="text-xs text-gray-500">
                      {getPropertyName(propId)}
                    </span>
                    <p className="text-sm font-medium text-primary-900">
                      {getOptionValue(optId)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
