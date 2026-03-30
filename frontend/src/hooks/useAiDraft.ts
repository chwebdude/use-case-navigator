import { useState, useCallback, useRef } from "react";
import type {
  FactsheetType,
  PropertyDefinition,
  PropertyOption,
} from "../types";

export interface AiDraft {
  name: string;
  description: string;
  responsibility: string;
  benefits: string;
  what_it_does: string;
  problems_addressed: string;
  potential_ui: string;
  properties: Record<string, string>; // property definition id -> option id
}

interface UseAiDraftOptions {
  factsheetTypes: FactsheetType[];
  propertyDefinitions: PropertyDefinition[];
  propertyOptions: PropertyOption[];
  llmEndpoint?: string;
  llmApiKey?: string;
  llmModel?: string;
}

export function useAiDraft({
  factsheetTypes,
  propertyDefinitions,
  propertyOptions,
  llmEndpoint,
  llmApiKey,
  llmModel,
}: UseAiDraftOptions) {
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastInputRef = useRef<string>("");

  const isConfigured = Boolean(llmEndpoint && llmApiKey && llmModel);

  const generateDraft = useCallback(
    async (name: string, description: string, typeId: string) => {
      if (!isConfigured || (!name.trim() && !description.trim())) return;

      // Skip if inputs haven't changed since last request
      const inputKey = `${name.trim()}|||${description.trim()}|||${typeId}`;
      if (inputKey === lastInputRef.current) return;
      lastInputRef.current = inputKey;

      // Abort previous request if still running
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const selectedType = factsheetTypes.find((t) => t.id === typeId);
        const hiddenFields = selectedType?.hidden_fields ?? [];

        // Build property context
        const propertyContext = propertyDefinitions.map((pd) => {
          const opts = propertyOptions
            .filter((o) => o.property === pd.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          return {
            id: pd.id,
            name: pd.name,
            options: opts.map((o) => ({ id: o.id, value: o.value })),
          };
        });

        const visibleFields = [
          "description",
          "responsibility",
          "benefits",
          "what_it_does",
          "problems_addressed",
          "potential_ui",
        ].filter((f) => !hiddenFields.includes(f as any));

        const systemPrompt = `You are an AI assistant helping to draft factsheets for the "Use Case Navigator" application. A factsheet describes a use case, capability, or technology component.

Given a name and optional description keywords, generate a comprehensive draft for the factsheet.

The factsheet type is: "${selectedType?.name || "Unknown"}"

Available fields to fill (only fill visible fields):
${visibleFields.map((f) => `- ${f}`).join("\n")}

${
  propertyContext.length > 0
    ? `Available properties and their options — you MUST pick exactly one option for each property. Use the option "id" value in the JSON output, NOT the label text.
${propertyContext.map((p) => `- "${p.name}" (property id: "${p.id}"):\n${p.options.map((o) => `    - "${o.value}" → use id: "${o.id}"`).join("\n")}`).join("\n")}`
    : ""
}

Respond ONLY with a valid JSON object. No markdown, no code fences, no explanation. The JSON must have:
- "name": string (a polished, improved version of the given name)
${visibleFields
  .map((f) => {
    const labels: Record<string, string> = {
      description:
        '"description": string (a few sentences describing the use case)',
      responsibility: '"responsibility": string (who is responsible)',
      benefits: '"benefits": string (key benefits)',
      what_it_does: '"what_it_does": string (what this does)',
      problems_addressed: '"problems_addressed": string (problems it solves)',
      potential_ui:
        '"potential_ui": string (potential user interface description)',
    };
    return `- ${labels[f]}`;
  })
  .join("\n")}
- "properties": object where each key is a property id and each value is the chosen option id (use the exact id strings listed above, not the label text)

For properties, pick the most appropriate option id based on the use case context. If no option fits, use an empty string.`;

        const userMessage = `Generate a factsheet draft for:
Name: "${name}"${description.trim() ? `\nDescription keywords: "${description}"` : ""}`;

        const baseUrl = llmEndpoint!.replace(/\/+$/, "");
        const url = baseUrl.includes("/chat/completions")
          ? baseUrl
          : `${baseUrl}/v1/chat/completions`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${llmApiKey}`,
          },
          body: JSON.stringify({
            model: llmModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`LLM request failed (${response.status}): ${text}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Parse JSON from response, stripping any potential code fences
        const jsonStr = content
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/, "")
          .trim();
        const parsed = JSON.parse(jsonStr);

        const aiDraft: AiDraft = {
          name: parsed.name || "",
          description: parsed.description || "",
          responsibility: parsed.responsibility || "",
          benefits: parsed.benefits || "",
          what_it_does: parsed.what_it_does || "",
          problems_addressed: parsed.problems_addressed || "",
          potential_ui: parsed.potential_ui || "",
          properties: {},
        };

        // Clear hidden fields so they never appear in the draft
        for (const hf of hiddenFields) {
          if (hf in aiDraft) {
            (aiDraft as unknown as Record<string, unknown>)[hf] = "";
          }
        }

        // Resolve property keys — LLM may return property names instead of IDs
        const rawProps: Record<string, string> = parsed.properties || {};
        const propNameToId = new Map(
          propertyDefinitions.map((pd) => [pd.name.toLowerCase(), pd.id]),
        );
        for (const [rawKey, rawOptId] of Object.entries(rawProps)) {
          if (!rawOptId) continue;
          // Resolve property key: could be an ID or a name
          const propId = propertyDefinitions.some((pd) => pd.id === rawKey)
            ? rawKey
            : propNameToId.get(rawKey.toLowerCase()) || null;
          if (!propId) continue;

          const validOpts = propertyOptions.filter(
            (o) => o.property === propId,
          );
          // Check if optId is already a valid option id
          if (validOpts.some((o) => o.id === rawOptId)) {
            aiDraft.properties[propId] = rawOptId as string;
          } else {
            // Try matching by value (case-insensitive)
            const matchByValue = validOpts.find(
              (o) => o.value.toLowerCase() === String(rawOptId).toLowerCase(),
            );
            aiDraft.properties[propId] = matchByValue ? matchByValue.id : "";
          }
        }

        // Fill in any properties the LLM didn't return at all
        for (const pd of propertyDefinitions) {
          if (!(pd.id in aiDraft.properties)) {
            aiDraft.properties[pd.id] = "";
          }
        }

        if (!controller.signal.aborted) {
          setDraft(aiDraft);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Failed to generate draft",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [
      isConfigured,
      factsheetTypes,
      propertyDefinitions,
      propertyOptions,
      llmEndpoint,
      llmApiKey,
      llmModel,
    ],
  );

  const clearDraft = useCallback(() => {
    setDraft(null);
    setError(null);
  }, []);

  return { draft, loading, error, isConfigured, generateDraft, clearDraft };
}
