import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Card, Button } from "../components/ui";
import Input, { Textarea } from "../components/ui/Input";
import { useRealtime, useRecord } from "../hooks/useRealtime";
import { useChangeLog } from "../hooks/useChangeLog";
import pb from "../lib/pocketbase";
import type { Factsheet, FactsheetExpanded } from "../types";

export default function DependencyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dependsOn, setDependsOn] = useState("");
  const [dependsOnSearch, setDependsOnSearch] = useState("");
  const [isDependsOnFocused, setIsDependsOnFocused] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] =
    useState(-1);
  const [description, setDescription] = useState("");

  const { record: sourceFactsheet } = useRecord<Factsheet>("factsheets", id);

  const { records: factsheets } = useRealtime<FactsheetExpanded>({
    collection: "factsheets",
    expand: "type",
  });

  const { logDependencyAdded } = useChangeLog();

  const availableFactsheets = useMemo(
    () => factsheets.filter((fs) => fs.id !== id),
    [factsheets, id],
  );

  const selectedDependsOnFactsheet = useMemo(
    () => availableFactsheets.find((fs) => fs.id === dependsOn),
    [availableFactsheets, dependsOn],
  );

  const filteredFactsheets = useMemo(() => {
    const query = dependsOnSearch.trim().toLowerCase();
    if (!query) return [];

    return availableFactsheets.filter((fs) => {
      const name = fs.name.toLowerCase();
      const details = (fs.description || "").toLowerCase();
      return name.includes(query) || details.includes(query);
    });
  }, [availableFactsheets, dependsOnSearch]);

  const shouldShowSuggestions =
    isDependsOnFocused && dependsOnSearch.trim().length > 0;
  const visibleSuggestions = useMemo(
    () => filteredFactsheets.slice(0, 10),
    [filteredFactsheets],
  );

  useEffect(() => {
    setHighlightedSuggestionIndex(-1);
  }, [dependsOnSearch]);

  useEffect(() => {
    if (!shouldShowSuggestions) {
      setHighlightedSuggestionIndex(-1);
      return;
    }

    if (visibleSuggestions.length === 0) {
      setHighlightedSuggestionIndex(-1);
      return;
    }

    if (highlightedSuggestionIndex >= visibleSuggestions.length) {
      setHighlightedSuggestionIndex(visibleSuggestions.length - 1);
    }
  }, [highlightedSuggestionIndex, shouldShowSuggestions, visibleSuggestions]);

  const selectDependsOnFactsheet = (factsheetId: string) => {
    const selected = availableFactsheets.find((fs) => fs.id === factsheetId);
    if (!selected) return;

    setDependsOn(selected.id);
    setDependsOnSearch(selected.name);
    setError("");
    setIsDependsOnFocused(false);
    setHighlightedSuggestionIndex(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dependsOn) {
      setError("Please select a factsheet to depend on");
      return;
    }

    setSaving(true);
    setError("");

    const descriptionTrimmed = description.trim() || undefined;
    const targetFactsheet = availableFactsheets.find(
      (fs) => fs.id === dependsOn,
    );

    try {
      await pb.collection("dependencies").create({
        factsheet: id,
        depends_on: dependsOn,
        description: descriptionTrimmed || null,
      });

      // Log the change for both factsheets
      if (sourceFactsheet && targetFactsheet) {
        await logDependencyAdded(
          id!,
          sourceFactsheet.name,
          dependsOn,
          targetFactsheet.name,
          descriptionTrimmed,
        );
      }

      navigate(`/factsheets/${id}`);
    } catch (err) {
      console.error("Failed to create dependency:", err);
      setError("Failed to create dependency");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/factsheets/${id}`}>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-primary-900">Add Dependency</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Input
                label="Depends On"
                value={dependsOnSearch}
                onChange={(e) => setDependsOnSearch(e.target.value)}
                onFocus={() => setIsDependsOnFocused(true)}
                onKeyDown={(e) => {
                  if (!shouldShowSuggestions || visibleSuggestions.length === 0)
                    return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedSuggestionIndex((prev) =>
                      prev < visibleSuggestions.length - 1 ? prev + 1 : 0,
                    );
                    return;
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedSuggestionIndex((prev) =>
                      prev > 0 ? prev - 1 : visibleSuggestions.length - 1,
                    );
                    return;
                  }

                  if (e.key === "Enter" && highlightedSuggestionIndex >= 0) {
                    e.preventDefault();
                    const suggestion =
                      visibleSuggestions[highlightedSuggestionIndex];
                    if (suggestion) {
                      selectDependsOnFactsheet(suggestion.id);
                    }
                    return;
                  }

                  if (e.key === "Escape") {
                    setIsDependsOnFocused(false);
                    setHighlightedSuggestionIndex(-1);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(() => setIsDependsOnFocused(false), 120);
                }}
                placeholder="Search by title or description..."
                hint="Type to search and pick a factsheet"
              />

              {shouldShowSuggestions && (
                <div className="absolute z-20 mt-1 w-full border border-gray-300 bg-white shadow-md max-h-64 overflow-y-auto">
                  {filteredFactsheets.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">
                      No matching factsheets found.
                    </p>
                  ) : (
                    visibleSuggestions.map((fs, index) => {
                      const isSelected = dependsOn === fs.id;
                      const isHighlighted =
                        highlightedSuggestionIndex === index;
                      return (
                        <button
                          key={fs.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            selectDependsOnFactsheet(fs.id);
                          }}
                          className={`
                            w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0
                            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-inset
                            ${isHighlighted ? "bg-gray-50" : isSelected ? "bg-accent-50" : "bg-white"}
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-primary-900 truncate">
                                {fs.name}
                              </p>
                              <p className="text-xs text-gray-600 mb-1">
                                {fs.expand?.type?.name || "Unknown"}
                              </p>
                              {fs.description && (
                                <p className="text-xs text-gray-500 line-clamp-2">
                                  {fs.description}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {selectedDependsOnFactsheet ? (
              <p className="text-sm text-gray-600">
                Selected:{" "}
                <span className="font-medium text-primary-900">
                  {selectedDependsOnFactsheet.name}
                </span>{" "}
                <span className="text-gray-500">
                  ({selectedDependsOnFactsheet.expand?.type?.name || "Unknown"})
                </span>
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Select one factsheet using the search above.
              </p>
            )}
          </div>

          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dependency relationship..."
            rows={3}
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Dependency"}
            </Button>
            <Link to={`/factsheets/${id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
