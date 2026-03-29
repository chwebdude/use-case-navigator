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
          onClick={() => onApply(draft)}
          icon={<Check className="w-4 h-4" />}
        >
          Apply Draft
        </Button>
      </div>

      <div className="space-y-4">
        {draft.name && (
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Suggested Name
            </h4>
            <p className="text-sm font-medium text-primary-900">
              {draft.name}
            </p>
          </div>
        )}

        {visibleFields.map(({ key, label }) => (
          <div key={key}>
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {label}
            </h4>
            <p className="text-sm text-primary-800 whitespace-pre-wrap">
              {draft[key] as string}
            </p>
          </div>
        ))}

        {propertyEntries.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Suggested Properties
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {propertyEntries.map(([propId, optId]) => (
                <div
                  key={propId}
                  className="bg-gray-50 px-3 py-2 border border-gray-200"
                >
                  <span className="text-xs text-gray-500">
                    {getPropertyName(propId)}
                  </span>
                  <p className="text-sm font-medium text-primary-900">
                    {getOptionValue(optId)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
