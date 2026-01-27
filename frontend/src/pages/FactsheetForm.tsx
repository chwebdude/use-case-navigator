import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Card, Button, Input, Select } from "../components/ui";
import { Textarea } from "../components/ui/Input";
import { useRecord, useRealtime } from "../hooks/useRealtime";
import { useChangeLog } from "../hooks/useChangeLog";
import pb from "../lib/pocketbase";
import type {
  Factsheet,
  FactsheetType,
  PropertyDefinition,
  PropertyOption,
  FactsheetProperty,
} from "../types";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export default function FactsheetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const { record: existingFactsheet, loading: loadingRecord } =
    useRecord<Factsheet>("factsheets", id);

  const { records: factsheetTypes } = useRealtime<FactsheetType>({
    collection: "factsheet_types",
    sort: "order",
  });

  const { records: propertyDefinitions } = useRealtime<PropertyDefinition>({
    collection: "property_definitions",
    sort: "order",
  });

  const { records: propertyOptions } = useRealtime<PropertyOption>({
    collection: "property_options",
    sort: "order",
  });

  const { records: existingProperties } = useRealtime<FactsheetProperty>({
    collection: "factsheet_properties",
    filter: id ? `factsheet = "${id}"` : 'id = ""',
  });

  const { logFactsheetCreated, logFactsheetUpdated, logPropertyChanged } =
    useChangeLog();

  const typeOptions = factsheetTypes.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  // Group options by property
  const optionsByProperty = useMemo(() => {
    const map = new Map<string, PropertyOption[]>();
    propertyOptions.forEach((opt) => {
      if (!map.has(opt.property)) {
        map.set(opt.property, []);
      }
      map.get(opt.property)!.push(opt);
    });
    map.forEach((opts) => {
      opts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    });
    return map;
  }, [propertyOptions]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "",
    status: "draft",
    responsibility: "",
    benefits: "",
    what_it_does: "",
    problems_addressed: "",
    potential_ui: "",
  });
  const [propertyValues, setPropertyValues] = useState<Record<string, string>>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingFactsheet) {
      setFormData({
        name: existingFactsheet.name,
        description: existingFactsheet.description || "",
        type: existingFactsheet.type,
        status: existingFactsheet.status,
        responsibility: existingFactsheet.responsibility || "",
        benefits: existingFactsheet.benefits || "",
        what_it_does: existingFactsheet.what_it_does || "",
        problems_addressed: existingFactsheet.problems_addressed || "",
        potential_ui: existingFactsheet.potential_ui || "",
      });
    }
  }, [existingFactsheet]);

  // Load existing property values when editing
  useEffect(() => {
    if (isEdit && existingProperties.length > 0) {
      const values: Record<string, string> = {};
      existingProperties.forEach((prop) => {
        values[prop.property] = prop.option;
      });
      setPropertyValues(values);
    }
  }, [existingProperties, isEdit]);

  // Initialize property values with empty strings for new factsheets
  useEffect(() => {
    if (
      !isEdit &&
      propertyDefinitions.length > 0 &&
      Object.keys(propertyValues).length === 0
    ) {
      const initialValues: Record<string, string> = {};
      propertyDefinitions.forEach((propDef) => {
        initialValues[propDef.id] = "";
      });
      setPropertyValues(initialValues);
    }
  }, [propertyDefinitions, isEdit, propertyValues]);

  // Set default type when types are loaded
  useEffect(() => {
    if (!isEdit && factsheetTypes.length > 0 && !formData.type) {
      setFormData((prev) => ({ ...prev, type: factsheetTypes[0].id }));
    }
  }, [factsheetTypes, isEdit, formData.type]);

  const handlePropertyChange = (propertyId: string, optionId: string) => {
    setPropertyValues((prev) => ({ ...prev, [propertyId]: optionId }));
  };

  const getOptionsForProperty = (propDefId: string) => {
    const opts = optionsByProperty.get(propDefId) || [];
    return [
      { value: "", label: "Select..." },
      ...opts.map((opt) => ({ value: opt.id, label: opt.value })),
    ];
  };

  // Helper to truncate long values for display
  const truncate = (str: string, maxLen = 50) => {
    if (!str) return "";
    // Strip HTML tags for display
    const plain = str.replace(/<[^>]*>/g, "");
    return plain.length > maxLen ? plain.substring(0, maxLen) + "..." : plain;
  };

  // Helper to get option value by id
  const getOptionValue = (optionId: string) => {
    const option = propertyOptions.find((o) => o.id === optionId);
    return option?.value || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.type) {
      setError("Please select a factsheet type");
      return;
    }

    setSaving(true);

    try {
      let factsheetId: string;

      if (isEdit && id) {
        // Track which fields changed with old/new values
        const fieldChanges: {
          field: string;
          oldValue?: string;
          newValue?: string;
        }[] = [];
        if (existingFactsheet) {
          if (formData.name !== existingFactsheet.name) {
            fieldChanges.push({
              field: "name",
              oldValue: existingFactsheet.name,
              newValue: formData.name,
            });
          }
          if (formData.description !== (existingFactsheet.description || "")) {
            fieldChanges.push({
              field: "description",
              oldValue: truncate(existingFactsheet.description || ""),
              newValue: truncate(formData.description),
            });
          }
          if (formData.type !== existingFactsheet.type) {
            const oldType =
              factsheetTypes.find((t) => t.id === existingFactsheet.type)
                ?.name || existingFactsheet.type;
            const newType =
              factsheetTypes.find((t) => t.id === formData.type)?.name ||
              formData.type;
            fieldChanges.push({
              field: "type",
              oldValue: oldType,
              newValue: newType,
            });
          }
          if (formData.status !== existingFactsheet.status) {
            fieldChanges.push({
              field: "status",
              oldValue: existingFactsheet.status,
              newValue: formData.status,
            });
          }
          if (
            formData.responsibility !== (existingFactsheet.responsibility || "")
          ) {
            fieldChanges.push({
              field: "responsibility",
              oldValue: truncate(existingFactsheet.responsibility || ""),
              newValue: truncate(formData.responsibility),
            });
          }
          if (formData.benefits !== (existingFactsheet.benefits || "")) {
            fieldChanges.push({
              field: "benefits",
              oldValue: truncate(existingFactsheet.benefits || ""),
              newValue: truncate(formData.benefits),
            });
          }
          if (
            formData.what_it_does !== (existingFactsheet.what_it_does || "")
          ) {
            fieldChanges.push({
              field: "what_it_does",
              oldValue: truncate(existingFactsheet.what_it_does || ""),
              newValue: truncate(formData.what_it_does),
            });
          }
          if (
            formData.problems_addressed !==
            (existingFactsheet.problems_addressed || "")
          ) {
            fieldChanges.push({
              field: "problems_addressed",
              oldValue: truncate(existingFactsheet.problems_addressed || ""),
              newValue: truncate(formData.problems_addressed),
            });
          }
          if (
            formData.potential_ui !== (existingFactsheet.potential_ui || "")
          ) {
            fieldChanges.push({
              field: "potential_ui",
              oldValue: truncate(existingFactsheet.potential_ui || ""),
              newValue: truncate(formData.potential_ui),
            });
          }
        }

        await pb.collection("factsheets").update(id, formData);
        factsheetId = id;

        // Log the update with field details
        if (fieldChanges.length > 0) {
          await logFactsheetUpdated(factsheetId, formData.name, fieldChanges);
        }
      } else {
        const created = await pb.collection("factsheets").create(formData);
        factsheetId = created.id;

        // Log the creation
        await logFactsheetCreated(factsheetId, formData.name);
      }

      // Save property values and track changes
      for (const propDef of propertyDefinitions) {
        const newOptionId = propertyValues[propDef.id];
        const existing = isEdit
          ? existingProperties.find((p) => p.property === propDef.id)
          : undefined;
        const oldOptionValue = existing
          ? getOptionValue(existing.option)
          : null;
        const newOptionValue = newOptionId ? getOptionValue(newOptionId) : null;

        // Check if there's a valid option selected (not empty string)
        if (newOptionId && newOptionId !== "" && newOptionId.trim()) {
          if (existing) {
            // Only update and log if the value actually changed
            if (existing.option !== newOptionId) {
              await pb.collection("factsheet_properties").update(existing.id, {
                option: newOptionId,
              });
              await logPropertyChanged(
                factsheetId,
                propDef.name,
                oldOptionValue,
                newOptionValue,
              );
            }
          } else {
            // Create new property record
            await pb.collection("factsheet_properties").create({
              factsheet: factsheetId,
              property: propDef.id,
              option: newOptionId,
            });
            // Log property set (only for edits, not for new factsheets)
            if (isEdit) {
              await logPropertyChanged(
                factsheetId,
                propDef.name,
                null,
                newOptionValue,
              );
            }
          }
        } else if (existing) {
          // Remove property if it exists but no longer has a value
          await pb.collection("factsheet_properties").delete(existing.id);
          await logPropertyChanged(
            factsheetId,
            propDef.name,
            oldOptionValue,
            null,
          );
        }
      }

      navigate("/factsheets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save factsheet");
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingRecord) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 w-1/3"></div>
            <div className="h-10 bg-gray-200"></div>
            <div className="h-32 bg-gray-200"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (factsheetTypes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <h1 className="text-2xl font-bold text-primary-900">New Factsheet</h1>
        </div>
        <Card className="text-center py-12">
          <h3 className="text-lg font-medium text-primary-900">
            No factsheet types defined
          </h3>
          <p className="text-gray-500 mt-2">
            Please create at least one factsheet type in Settings before
            creating a factsheet.
          </p>
          <Button className="mt-4" onClick={() => navigate("/settings")}>
            Go to Settings
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
        <h1 className="text-2xl font-bold text-primary-900">
          {isEdit ? "Edit Factsheet" : "New Factsheet"}
        </h1>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <Select
            label="Type"
            options={typeOptions}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          />

          <Input
            label="Name"
            placeholder="Enter factsheet name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe the factsheet..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={4}
          />

          <Select
            label="Status"
            options={statusOptions}
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
          />

          {/* Property selections */}
          {propertyDefinitions.length > 0 && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">
                Properties
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {propertyDefinitions.map((propDef) => (
                  <Select
                    key={propDef.id}
                    label={propDef.name}
                    options={getOptionsForProperty(propDef.id)}
                    value={propertyValues[propDef.id] || ""}
                    onChange={(e) =>
                      handlePropertyChange(propDef.id, e.target.value)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Additional Details
            </h3>

            <div className="space-y-6">
              <Input
                label="Responsibility"
                placeholder="Who is responsible for this?"
                value={formData.responsibility}
                onChange={(e) =>
                  setFormData({ ...formData, responsibility: e.target.value })
                }
              />

              <Textarea
                label="Benefits"
                placeholder="What are the benefits?"
                value={formData.benefits}
                onChange={(e) =>
                  setFormData({ ...formData, benefits: e.target.value })
                }
                rows={3}
              />

              <Textarea
                label="What it does"
                placeholder="Describe what this does..."
                value={formData.what_it_does}
                onChange={(e) =>
                  setFormData({ ...formData, what_it_does: e.target.value })
                }
                rows={3}
              />

              <Textarea
                label="Problems addressed"
                placeholder="What problems does this address?"
                value={formData.problems_addressed}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    problems_addressed: e.target.value,
                  })
                }
                rows={3}
              />

              <Textarea
                label="Potential User Interface"
                placeholder="Describe the potential user interface..."
                value={formData.potential_ui}
                onChange={(e) =>
                  setFormData({ ...formData, potential_ui: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              loading={saving}
              icon={<Save className="w-4 h-4" />}
            >
              {isEdit ? "Save Changes" : "Create Factsheet"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
