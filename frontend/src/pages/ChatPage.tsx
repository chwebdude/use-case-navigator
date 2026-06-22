import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, AlertCircle, Loader2, Trash2, Wrench } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Button } from "../components/ui";
import { Card, CardTitle } from "../components/ui";
import ChatChart, { parseChartBlocks } from "../components/ChatChart";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useAppSettings } from "../hooks/useAppSettings";
import pb from "../lib/pocketbase";
import { getStatusMeta, normalizeStatuses } from "../lib/statusConfig";
import type {
  Factsheet,
  FactsheetType,
  Dependency,
  Metric,
  PropertyDefinition,
  FactsheetProperty,
  StatusDefinition,
} from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

// Tool calling API message types
type ApiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type ApiAssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: ApiToolCall[];
};

type ApiToolResultMessage = {
  role: "tool";
  content: string;
  tool_call_id: string;
  name: string;
};

type ApiUserMessage = {
  role: "user";
  content: string;
};

type ApiSystemMessage = {
  role: "system";
  content: string;
};

type ApiMessage =
  | ApiSystemMessage
  | ApiUserMessage
  | ApiAssistantMessage
  | ApiToolResultMessage;

function resolveStatusLabel(
  f: Factsheet,
  globalStatuses: StatusDefinition[] | undefined,
  typeObj?: FactsheetType,
): string {
  const statusId = f.status_id || f.status;
  return getStatusMeta(statusId, globalStatuses, typeObj).label;
}

// Tool calling definitions
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_statistics",
      description:
        "Get statistics about factsheets including total count, by type, by status",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_factsheets",
      description:
        "Search and list factsheets across all factsheet fields (name, description, responsibility, review metadata, status, etc.)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search term for factsheet name, responsibility, reviewer, or descriptive text",
          },
          type_id: {
            type: "string",
            description: "Filter by factsheet type ID",
          },
          status: {
            type: "string",
            description: "Filter by status",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default 10)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_factsheet_details",
      description:
        "Get detailed information about a specific factsheet including dependencies and properties",
      parameters: {
        type: "object",
        properties: {
          factsheet_id: {
            type: "string",
            description: "The ID of the factsheet",
          },
        },
        required: ["factsheet_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dependencies",
      description:
        "Get dependency relationships between factsheets",
      parameters: {
        type: "object",
        properties: {
          factsheet_id: {
            type: "string",
            description: "Filter dependencies for a specific factsheet",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_metric_scores",
      description:
        "Get calculated metric scores for factsheets",
      parameters: {
        type: "object",
        properties: {
          factsheet_id: {
            type: "string",
            description: "Get metrics for a specific factsheet",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_all_data_context",
      description:
        "Fallback tool that returns comprehensive factsheets, dependencies, metrics, and summary statistics for data-grounded answers",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
];

// Tool executor functions
async function executeGetStatistics(): Promise<string> {
  const [factsheets, types, statuses] = await Promise.all([
    pb.collection("factsheets").getFullList<Factsheet>(),
    pb.collection("factsheet_types").getFullList<FactsheetType>(),
    pb.collection("app_settings").getFullList(),
  ]);

  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
  const globalStatuses =
    statuses.length > 0 ? normalizeStatuses(statuses[0].statuses) : undefined;
  const statusCounts: Record<string, number> = {};

  factsheets.forEach((f) => {
    const label = resolveStatusLabel(f, globalStatuses);
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });

  const typeStats = factsheets.reduce(
    (acc, f) => {
      const typeName = typeMap[f.type] || "Unknown";
      acc[typeName] = (acc[typeName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return JSON.stringify({
    total_factsheets: factsheets.length,
    by_type: typeStats,
    by_status: statusCounts,
  });
}

async function executeSearchFactsheets(args: {
  query?: string;
  type_id?: string;
  status?: string;
  limit?: number;
}): Promise<string> {
  const limit = Math.min(args.limit || 10, 50);
  const [factsheets, types, propertyDefs, propertyOptions, factsheetProperties] = await Promise.all([
    pb.collection("factsheets").getFullList<Factsheet>(),
    pb.collection("factsheet_types").getFullList<FactsheetType>(),
    pb.collection("property_definitions").getFullList<PropertyDefinition>(),
    pb.collection("property_options").getFullList(),
    pb.collection("factsheet_properties").getFullList<FactsheetProperty>(),
  ]);

  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
  const propNameById = Object.fromEntries(propertyDefs.map((p) => [p.id, p.name]));
  const optionById = Object.fromEntries(
    propertyOptions.map((o) => [o.id, o as { id: string; value?: string; weight?: number }]),
  );
  const propsByFactsheet = new Map<string, Array<{ property: string; value: string; weight?: number }>>();
  for (const fp of factsheetProperties) {
    const propName = propNameById[fp.property] || fp.property;
    const opt = optionById[fp.option];
    const value = opt?.value || fp.option;
    const existing = propsByFactsheet.get(fp.factsheet) || [];
    existing.push({ property: propName, value, weight: opt?.weight });
    propsByFactsheet.set(fp.factsheet, existing);
  }

  const statusQuery = args.status?.toLowerCase().trim();
  const phraseQuery = args.query?.toLowerCase().trim() || "";
  const wantsVerified = /\bverified\b|\breviewed\b/.test(phraseQuery);
  const wantsUnverified = /\bunverified\b|\bnot verified\b|\bnot reviewed\b/.test(
    phraseQuery,
  );
  const stopwords = new Set([
    "where",
    "what",
    "which",
    "who",
    "is",
    "are",
    "the",
    "a",
    "an",
    "in",
    "on",
    "for",
    "to",
    "of",
    "and",
    "or",
  ]);
  const queryTokens = phraseQuery
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stopwords.has(t));
  const intentNoiseTokens = new Set([
    "factsheet",
    "factsheets",
    "verified",
    "reviewed",
    "maturity",
    "level",
    "levels",
    "prescriptive",
  ]);
  const contentTokens = queryTokens.filter((t) => !intentNoiseTokens.has(t));

  const filtered = factsheets.filter((f) => {
    if (args.type_id && f.type !== args.type_id) return false;

    if (statusQuery) {
      const fsStatus = `${f.status_id || ""} ${f.status || ""}`.toLowerCase();
      if (!fsStatus.includes(statusQuery)) return false;
    }

    if (wantsVerified && !wantsUnverified && !Boolean(f.reviewed)) return false;
    if (wantsUnverified && Boolean(f.reviewed)) return false;

    if (!phraseQuery) return true;

    if ((wantsVerified || wantsUnverified) && contentTokens.length === 0) {
      // For direct verification intent, the reviewed filter above is authoritative.
      return true;
    }

    const factsheetProps = propsByFactsheet.get(f.id) || [];
    const propsText = factsheetProps
      .map((p) => `${p.property} ${p.value}`)
      .join(" ");

    const haystack = [
      f.id,
      f.name,
      f.description,
      f.type,
      typeMap[f.type] || "",
      f.status,
      f.status_id,
      f.review_comment,
      f.reviewed_by,
      f.reviewed_at,
      f.responsibility,
      f.benefits,
      f.what_it_does,
      f.problems_addressed,
      f.potential_ui,
      String(Boolean(f.reviewed)),
      propsText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (haystack.includes(phraseQuery)) return true;

    // Fall back to token matching for natural-language queries.
    const tokensToMatch = contentTokens.length > 0 ? contentTokens : queryTokens;
    return tokensToMatch.some((token) => haystack.includes(token));
  });

  const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);

  return JSON.stringify(
    sorted.map((f) => ({
      id: f.id,
      name: f.name,
      type_id: f.type,
      type: typeMap[f.type] || "Unknown",
      status: f.status_id || f.status,
      reviewed: Boolean(f.reviewed),
      review_comment: f.review_comment || null,
      reviewed_by: f.reviewed_by || null,
      reviewed_at: f.reviewed_at || null,
      responsibility: f.responsibility || null,
      description: f.description || null,
      what_it_does: f.what_it_does || null,
      benefits: f.benefits || null,
      problems_addressed: f.problems_addressed || null,
      potential_ui: f.potential_ui || null,
      properties: (propsByFactsheet.get(f.id) || []).map((p) => ({
        property: p.property,
        value: p.value,
        weight: p.weight ?? null,
      })),
    })),
  );
}

async function executeGetFactsheetDetails(args: {
  factsheet_id: string;
}): Promise<string> {
  const fs = await pb.collection("factsheets").getOne<Factsheet>(args.factsheet_id);
  const [typeObj, deps, allFactsheets, propertyDefs, propertyOptions, factsheetProps] = await Promise.all([
    pb.collection("factsheet_types").getOne<FactsheetType>(fs.type, {
      fields: "id,name",
    }),
    pb.collection("dependencies").getFullList<Dependency>({
      filter: `factsheet = "${args.factsheet_id}" || depends_on = "${args.factsheet_id}"`,
    }),
    pb.collection("factsheets").getFullList<Factsheet>({ fields: "id,name" }),
    pb.collection("property_definitions").getFullList<PropertyDefinition>(),
    pb.collection("property_options").getFullList(),
    pb.collection("factsheet_properties").getFullList<FactsheetProperty>({
      filter: `factsheet = "${args.factsheet_id}"`,
    }),
  ]);

  const involvedIds = [...new Set(deps.flatMap((d) => [d.factsheet, d.depends_on]))];
  const involvedFactsheets = allFactsheets.filter((f) =>
    involvedIds.includes(f.id),
  );
  const factsheetNameById = Object.fromEntries(
    involvedFactsheets.map((f) => [f.id, f.name]),
  );
  const propNameById = Object.fromEntries(propertyDefs.map((p) => [p.id, p.name]));
  const optionById = Object.fromEntries(
    propertyOptions.map((o) => [o.id, o as { id: string; value?: string; weight?: number }]),
  );
  const properties = factsheetProps.map((fp) => ({
    property: propNameById[fp.property] || fp.property,
    value: optionById[fp.option]?.value || fp.option,
    weight: optionById[fp.option]?.weight ?? null,
  }));

  const depDetails = deps.map((d) => ({
    source_factsheet_id: d.factsheet,
    source_factsheet_name: factsheetNameById[d.factsheet] || d.factsheet,
    target_factsheet_id: d.depends_on,
    target_factsheet_name: factsheetNameById[d.depends_on] || d.depends_on,
    description: d.description ?? null,
  }));

  return JSON.stringify({
    id: fs.id,
    name: fs.name,
    type: typeObj.name,
    status: fs.status_id || fs.status,
    reviewed: Boolean(fs.reviewed),
    review_comment: fs.review_comment || null,
    reviewed_by: fs.reviewed_by || null,
    reviewed_at: fs.reviewed_at || null,
    responsibility: fs.responsibility || null,
    description: fs.description,
    what_it_does: fs.what_it_does,
    benefits: fs.benefits,
    problems_addressed: fs.problems_addressed || null,
    potential_ui: fs.potential_ui || null,
    properties,
    dependencies: depDetails,
  });
}

async function executeGetDependencies(args: {
  factsheet_id?: string;
}): Promise<string> {
  let filter = '';
  if (args.factsheet_id) {
    filter = `factsheet = "${args.factsheet_id}" || depends_on = "${args.factsheet_id}"`;
  }

  const deps = await pb.collection("dependencies").getFullList<Dependency>({ filter: filter || undefined, limit: 100 });

  const involvedIds = [...new Set(deps.flatMap((d) => [d.factsheet, d.depends_on]))];
  const allFactsheets = await pb
    .collection("factsheets")
    .getFullList<Factsheet>({ fields: "id,name" });
  const involvedFactsheets = allFactsheets.filter((f) =>
    involvedIds.includes(f.id),
  );
  const factsheetNameById = Object.fromEntries(
    involvedFactsheets.map((f) => [f.id, f.name]),
  );

  return JSON.stringify(
    deps.map((d) => ({
      source_factsheet_id: d.factsheet,
      source_factsheet_name: factsheetNameById[d.factsheet] || d.factsheet,
      target_factsheet_id: d.depends_on,
      target_factsheet_name: factsheetNameById[d.depends_on] || d.depends_on,
      description: d.description ?? null,
    })),
  );
}

async function executeGetMetricScores(args: {
  factsheet_id?: string;
}): Promise<string> {
  const [factsheets, metrics, fpLinks] = await Promise.all([
    args.factsheet_id
      ? pb.collection("factsheets").getOne<Factsheet>(args.factsheet_id)
      : pb.collection("factsheets").getFullList<Factsheet>({ limit: 100 }),
    pb
      .collection("metrics")
      .getFullList<Metric>({ expand: "properties", sort: "order,name" }),
    pb.collection("factsheet_properties").getFullList<FactsheetProperty>(),
  ]);

  const fsArray = Array.isArray(factsheets) ? factsheets : [factsheets];
  const fpLookup = new Map<string, Map<string, FactsheetProperty>>();

  fpLinks.forEach((fp) => {
    if (!fpLookup.has(fp.factsheet)) {
      fpLookup.set(fp.factsheet, new Map());
    }
    fpLookup.get(fp.factsheet)!.set(fp.property, fp);
  });

  const scores = fsArray.map((f) => {
    const metricScores: Record<string, number | null> = {};

    metrics.forEach((m) => {
      const metricProperties = m.properties?.length
        ? m.properties
        : ((m as Metric & { expand?: { properties?: PropertyDefinition[] } })
            .expand?.properties?.map((p) => p.id) ?? []);

      if (metricProperties.length === 0) {
        metricScores[m.name] = null;
        return;
      }

      const fsProps = fpLookup.get(f.id);
      if (!fsProps) {
        metricScores[m.name] = null;
        return;
      }

      const values = metricProperties
        .map((pId) => fsProps.get(pId)?.numeric_value)
        .filter((v) => v !== undefined) as number[];

      if (values.length === 0) {
        metricScores[m.name] = null;
        return;
      }

      const weights = metricProperties
        .map((pId) => fsProps.get(pId)?.weight ?? 1)
        .filter((w) => w !== undefined) as number[];

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const maxMetric = m.max_metric ?? 1;
      const score = (values.reduce((a, b, i) => a + b * weights[i], 0) / totalWeight) / maxMetric;
      metricScores[m.name] = Math.min(1, Math.max(0, score));
    });

    return { factsheet_id: f.id, factsheet_name: f.name, scores: metricScores };
  });

  return JSON.stringify(scores);
}

async function executeGetAllDataContext(): Promise<string> {
  const [factsheets, types, dependencies, statistics, metricScores, propertyDefs, propertyOptions, factsheetProperties] =
    await Promise.all([
      pb.collection("factsheets").getFullList<Factsheet>({
        fields:
          "id,name,type,status,status_id,reviewed,review_comment,reviewed_by,reviewed_at,responsibility,description,what_it_does,benefits,problems_addressed,potential_ui",
      }),
      pb.collection("factsheet_types").getFullList<FactsheetType>({
        fields: "id,name",
      }),
      pb.collection("dependencies").getFullList<Dependency>(),
      executeGetStatistics(),
      executeGetMetricScores({}),
      pb.collection("property_definitions").getFullList<PropertyDefinition>(),
      pb.collection("property_options").getFullList(),
      pb.collection("factsheet_properties").getFullList<FactsheetProperty>(),
    ]);

  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
  const factsheetNameById = Object.fromEntries(factsheets.map((f) => [f.id, f.name]));
  const propNameById = Object.fromEntries(propertyDefs.map((p) => [p.id, p.name]));
  const optionById = Object.fromEntries(
    propertyOptions.map((o) => [o.id, o as { id: string; value?: string; weight?: number }]),
  );
  const propsByFactsheet = new Map<string, Array<{ property: string; value: string; weight?: number }>>();
  for (const fp of factsheetProperties) {
    const propName = propNameById[fp.property] || fp.property;
    const opt = optionById[fp.option];
    const value = opt?.value || fp.option;
    const existing = propsByFactsheet.get(fp.factsheet) || [];
    existing.push({ property: propName, value, weight: opt?.weight });
    propsByFactsheet.set(fp.factsheet, existing);
  }

  return JSON.stringify({
    summary: JSON.parse(statistics),
    factsheets: factsheets.map((f) => ({
      id: f.id,
      name: f.name,
      type_id: f.type,
      type: typeMap[f.type] || "Unknown",
      status: f.status_id || f.status,
      reviewed: Boolean(f.reviewed),
      review_comment: f.review_comment || null,
      reviewed_by: f.reviewed_by || null,
      reviewed_at: f.reviewed_at || null,
      responsibility: f.responsibility || null,
      description: f.description || null,
      what_it_does: f.what_it_does || null,
      benefits: f.benefits || null,
      problems_addressed: f.problems_addressed || null,
      potential_ui: f.potential_ui || null,
      properties: (propsByFactsheet.get(f.id) || []).map((p) => ({
        property: p.property,
        value: p.value,
        weight: p.weight ?? null,
      })),
    })),
    dependencies: dependencies.map((d) => ({
      source_factsheet_id: d.factsheet,
      source_factsheet_name: factsheetNameById[d.factsheet] || d.factsheet,
      target_factsheet_id: d.depends_on,
      target_factsheet_name: factsheetNameById[d.depends_on] || d.depends_on,
      description: d.description ?? null,
    })),
    metric_scores: JSON.parse(metricScores),
  });
}

async function executeToolCall(name: string, rawArgs: string): Promise<string> {
  const args = rawArgs ? JSON.parse(rawArgs) : {};

  switch (name) {
    case "get_statistics":
      return executeGetStatistics();
    case "search_factsheets":
      return executeSearchFactsheets(args);
    case "get_factsheet_details":
      return executeGetFactsheetDetails(args);
    case "get_dependencies":
      return executeGetDependencies(args);
    case "get_metric_scores":
      return executeGetMetricScores(args);
    case "get_all_data_context":
      return executeGetAllDataContext();
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

const SYSTEM_PROMPT = `You are a helpful assistant for analyzing enterprise use cases and factsheets.
You MUST base every answer on data retrieved via tools from the Use Case Navigator.
For every user question, call one or more tools first, then answer using those results.
Never provide a generic answer without tool data.
If tool data is unavailable, explicitly say which tool failed and what data is missing.
Format your responses clearly and include specific figures/names from tool outputs.`;

async function runAgenticLoop(
  apiMessages: ApiMessage[],
  endpoint: string,
  apiKey: string,
  model: string,
  onToolsActive: (tools: string[]) => void,
): Promise<{ answer: string; toolCalls: string[] }> {
  const baseUrl = endpoint.replace(/\/+$/, "");

  const requestCompletion = async (
    messages: ApiMessage[],
    includeTools: boolean,
    forcedToolName?: string,
  ): Promise<{
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  }> => {
    const controller = new AbortController();
    const timeoutMs = 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          ...(includeTools
            ? {
                tools: TOOLS,
                tool_choice: forcedToolName
                  ? {
                      type: "function",
                      function: { name: forcedToolName },
                    }
                  : "auto",
              }
            : {}),
          temperature: 0,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          `LLM API request timed out after ${timeoutMs / 1000}s.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `LLM API error (${response.status} ${response.statusText}): ${details}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error("No message in LLM response");
    }

    return message;
  };

  // Prepend system message if not present
  if (apiMessages.length === 0 || apiMessages[0].role !== "system") {
    apiMessages.unshift({
      role: "system",
      content: SYSTEM_PROMPT,
    });
  }

  const latestUserMessage = [...apiMessages]
    .reverse()
    .find((m) => m.role === "user")?.content.toLowerCase() || "";
  const shouldForceSearchTool =
    /\bverified\b|\breviewed\b/.test(latestUserMessage) ||
    (/\bmaturity\b/.test(latestUserMessage) && /\bprescriptive\b/.test(latestUserMessage));

  if (shouldForceSearchTool) {
    const forcedToolCall = {
      id: `forced_search_factsheets_${Date.now()}`,
      type: "function" as const,
      function: {
        name: "search_factsheets",
        arguments: JSON.stringify({ query: latestUserMessage, limit: 50 }),
      },
    };

    apiMessages.push({
      role: "assistant",
      content: null,
      tool_calls: [forcedToolCall],
    } as ApiAssistantMessage);

    onToolsActive([forcedToolCall.function.name]);

    const forcedResult = await executeToolCall(
      forcedToolCall.function.name,
      forcedToolCall.function.arguments,
    );

    apiMessages.push({
      role: "tool",
      name: forcedToolCall.function.name,
      content: forcedResult,
      tool_call_id: forcedToolCall.id,
    } as ApiToolResultMessage);

    const forcedFinalPhase = await requestCompletion(apiMessages, false);
    apiMessages.push({
      role: "assistant",
      content: forcedFinalPhase.content,
    } as ApiAssistantMessage);

    onToolsActive([]);
    return {
      answer:
        forcedFinalPhase.content ||
        "I could not produce a final answer from forced search tool data.",
      toolCalls: [forcedToolCall.function.name],
    };
  }

  // Step 1: Ask model to call tools.
  const toolPhase = await requestCompletion(apiMessages, true);
  apiMessages.push({
    role: "assistant",
    content: toolPhase.content,
    tool_calls: toolPhase.tool_calls,
  } as ApiAssistantMessage);

  if (!toolPhase.tool_calls || toolPhase.tool_calls.length === 0) {
    const forcedToolPhase = await requestCompletion(
      apiMessages,
      true,
      "get_all_data_context",
    );

    const forcedToolCall = forcedToolPhase.tool_calls?.[0] ?? {
      id: `forced_get_all_data_context_${Date.now()}`,
      type: "function" as const,
      function: { name: "get_all_data_context", arguments: "{}" },
    };

    apiMessages.push({
      role: "assistant",
      content: forcedToolPhase.content,
      tool_calls: [forcedToolCall],
    } as ApiAssistantMessage);

    onToolsActive([forcedToolCall.function.name]);

    const forcedResult = await executeToolCall(
      forcedToolCall.function.name,
      forcedToolCall.function.arguments,
    );

    apiMessages.push({
      role: "tool",
      name: forcedToolCall.function.name,
      content: forcedResult,
      tool_call_id: forcedToolCall.id,
    } as ApiToolResultMessage);

    const forcedFinalPhase = await requestCompletion(apiMessages, false);
    apiMessages.push({
      role: "assistant",
      content: forcedFinalPhase.content,
    } as ApiAssistantMessage);

    onToolsActive([]);
    return {
      answer:
        forcedFinalPhase.content ||
        "I could not produce a final answer from fallback tool data.",
      toolCalls: [forcedToolCall.function.name],
    };
  }

  const toolNames = toolPhase.tool_calls.map((t) => t.function.name);
  onToolsActive(toolNames);

  const toolResults = await Promise.all(
    toolPhase.tool_calls.map((toolCall) =>
      executeToolCall(toolCall.function.name, toolCall.function.arguments)
        .then((result) => ({
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result,
        }))
        .catch((err) => ({
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify({ error: err.message }),
        })),
    ),
  );

  toolResults.forEach((result) => {
    apiMessages.push({
      role: "tool",
      name: result.name,
      content: result.content,
      tool_call_id: result.tool_call_id,
    } as ApiToolResultMessage);
  });

  // Step 2: Ask model for a final answer grounded in returned tool data.
  const finalPhase = await requestCompletion(apiMessages, false);
  apiMessages.push({
    role: "assistant",
    content: finalPhase.content,
  } as ApiAssistantMessage);

  onToolsActive([]);
  return {
    answer:
      finalPhase.content || "I could not produce a final answer from tool data.",
    toolCalls: toolNames,
  };
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-1.5 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-3 border-gray-300 pl-3 my-2 text-gray-600 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-300" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-accent-500 underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-gray-800 text-gray-100 rounded p-3 overflow-x-auto my-2 text-xs">
      {children}
    </pre>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    const isBlock = className?.startsWith("language-");
    return isBlock ? (
      <code>{children}</code>
    ) : (
      <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">
        {children}
      </code>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-2">
      <table className="border-collapse border border-gray-300 text-xs w-full">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-300 px-2 py-1 bg-gray-200 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-300 px-2 py-1">{children}</td>
  ),
};

function linkifyFactsheets(
  text: string,
  factsheetMap: Map<string, string>,
): string {
  if (factsheetMap.size === 0) return text;
  // Sort longest-first so longer names match before shorter substrings
  const entries = [...factsheetMap.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  );
  const placeholders: string[] = [];

  for (const [name, id] of entries) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const link = `[${name}](factsheet:${id})`;
    const idx = placeholders.length;
    placeholders.push(link);
    const ph = `\x00FS${idx}\x00`;
    // Match bold, quoted, then plain text occurrences
    text = text.replace(new RegExp(`\\*\\*${escaped}\\*\\*`, "g"), ph);
    text = text.replace(new RegExp(`"${escaped}"`, "g"), ph);
    text = text.replace(
      new RegExp(`(?<![\\w[(/])${escaped}(?![\\w\\]])`, "g"),
      ph,
    );
  }

  for (let i = 0; i < placeholders.length; i++) {
    text = text.replaceAll(`\x00FS${i}\x00`, placeholders[i]);
  }

  return text;
}

function factsheetUrlTransform(url: string): string {
  if (url.startsWith("factsheet:")) return url;
  return defaultUrlTransform(url);
}

function normalizeAssistantMarkdown(content: string): string {
  // Some model outputs wrap factsheet markdown links in inline code, which prevents link rendering.
  // Convert code spans containing a single factsheet link back to normal markdown links.
  // Handles variants like `[Name](factsheet:id)` and "[Name](factsheet:id)".
  return content
    .replace(/`\s*"(\[[^\]]+\]\(factsheet:[^)]+\))"\s*`/g, "$1")
    .replace(/`\s*(\[[^\]]+\]\(factsheet:[^)]+\))\s*`/g, "$1");
}

function hideRecordIdsInMarkdown(content: string): string {
  // Hide explicit PocketBase-like record ID labels (15 lowercase alnum chars)
  // without mutating general markdown text.
  // 1) Protect markdown links so link targets (factsheet:<id>) are never modified.
  // 2) Remove only explicit ID labels/parenthetical artifacts.
  const linkPlaceholders: string[] = [];
  let sanitized = content.replace(
    /\[[^\]]+\]\([^\)]+\)/g,
    (match) => {
      const idx = linkPlaceholders.length;
      linkPlaceholders.push(match);
      return `\u0000LINK${idx}\u0000`;
    },
  );

  // Remove inline-code IDs, e.g. `y010z53xd4te5np`
  sanitized = sanitized.replace(/`[a-z0-9]{15}`/g, "");

  // Remove parenthetical ID labels, e.g. "(ID: y010...)"
  sanitized = sanitized.replace(/\(\s*id\s*:\s*[a-z0-9]{15}\s*\)/gi, "");

  // Remove explicit id labels, e.g. "id y010..." or "id: y010..."
  sanitized = sanitized.replace(/\bid\s*:?\s*[a-z0-9]{15}\b/gi, "");

  // Remove explicit "ID: <id>" list labels, e.g. "- ID: y010..."
  sanitized = sanitized.replace(/(^|\n)(\s*[-*]?\s*id\s*:\s*)[a-z0-9]{15}(?=\s|$)/gi, "$1$2");

  // Remove parenthetical leading IDs, e.g. "(y010..., status: in_use)"
  sanitized = sanitized.replace(/\(\s*[a-z0-9]{15}\s*,/g, "(");

  // Restore protected links.
  sanitized = sanitized.replace(/\u0000LINK(\d+)\u0000/g, (_m, n) => {
    return linkPlaceholders[Number(n)] ?? "";
  });

  // Clean up leftover punctuation/spacing from removals.
  sanitized = sanitized
    .replace(/\(\s*,/g, "(")
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n\s+\n/g, "\n\n");

  return sanitized;
}

function AssistantMessage({
  content,
  factsheetMap,
  onFactsheetClick,
}: {
  content: string;
  factsheetMap: Map<string, string>;
  onFactsheetClick: (id: string) => void;
}) {
  const normalizedContent = normalizeAssistantMarkdown(content);
  const displayContent = hideRecordIdsInMarkdown(normalizedContent);
  const parts = parseChartBlocks(displayContent);

  const components = {
    ...markdownComponents,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("factsheet:")) {
        const id = href.slice("factsheet:".length);
        return (
          <button
            type="button"
            onClick={() => onFactsheetClick(id)}
            className="text-accent-500 underline hover:text-accent-700 cursor-pointer"
          >
            {children}
          </button>
        );
      }
      return (
        <a
          href={href}
          className="text-accent-500 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <>
      {parts.map((part, i) =>
        part.type === "chart" ? (
          <ChatChart key={i} chart={part.chart} />
        ) : (
          <ReactMarkdown
            key={i}
            components={components}
            urlTransform={factsheetUrlTransform}
          >
            {linkifyFactsheets(part.content, factsheetMap)}
          </ReactMarkdown>
        ),
      )}
    </>
  );
}

export default function ChatPage() {
  const { settings } = useAppSettings();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolsActive, setToolsActive] = useState<string[]>([]);
  const [factsheetMap, setFactsheetMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const apiMessages = useRef<ApiMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfigured =
    settings.llmEndpoint && settings.llmApiKey && settings.llmModel;

  // Load factsheet names for response linkification (id+name only — lightweight)
  useEffect(() => {
    pb.collection("factsheets")
      .getFullList<Factsheet>({ fields: "id,name" })
      .then((factsheets) => {
        setFactsheetMap(new Map(factsheets.map((f) => [f.name, f.id])));
      })
      .catch((err) => console.error("Failed to load factsheet names:", err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !isConfigured) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    // Add user message to API message history
    apiMessages.current.push({ role: "user", content: trimmed });

    try {
      const { answer, toolCalls } = await runAgenticLoop(
        apiMessages.current,
        settings.llmEndpoint!,
        settings.llmApiKey!,
        settings.llmModel!,
        setToolsActive,
      );

      const toolMessage: ChatMessage | null =
        toolCalls.length > 0
          ? {
              role: "tool",
              content: `Tool calls: ${toolCalls.join(", ")}`,
            }
          : null;

      // Add tool call trace and assistant response to UI; runAgenticLoop already maintains API history.
      setMessages((prev) => [
        ...prev,
        ...(toolMessage ? [toolMessage] : []),
        { role: "assistant", content: answer },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, isConfigured, settings]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setToolsActive([]);
    apiMessages.current = [];
  };

  if (!isConfigured) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <CardTitle>LLM Not Configured</CardTitle>
          </div>
          <p className="text-gray-600 mb-2">
            To use the chat feature, configure the LLM settings in the{" "}
            <a href="/settings" className="text-accent-500 underline">
              Settings page
            </a>
            .
          </p>
          <p className="text-sm text-gray-500">
            You need to provide a LiteLLM-compatible endpoint URL, an API key,
            and a model name.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 py-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">
            Talk to the Data
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Ask questions about your factsheets, dependencies, properties, and
            metrics
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="secondary" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1">
        {toolsActive.length > 0 && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4 justify-center">
            <Wrench className="w-4 h-4 animate-spin" />
            {toolsActive.map((t) => `${t.replace(/_/g, " ")}…`).join(", ")}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm mt-1">
              Ask about factsheets, dependencies, properties, metrics, or
              statistics.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {[
                "How many factsheets are there?",
                "Which factsheets have the most dependencies?",
                "Summarize the factsheets by status",
                "What are the dependency chains?",
                "Show the calculated metrics for each factsheet",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-full text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-accent-600" />
              </div>
            )}
            {msg.role === "tool" && (
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-1">
                <Wrench className="w-4 h-4 text-amber-700" />
              </div>
            )}
            <div
              className={`max-w-[75%] px-4 py-3 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-accent-500 text-white whitespace-pre-wrap"
                  : msg.role === "tool"
                    ? "bg-amber-50 text-amber-900 border border-amber-200"
                    : "bg-gray-100 text-primary-900"
              }`}
            >
              {msg.role === "assistant" ? (
                <AssistantMessage
                  content={msg.content}
                  factsheetMap={factsheetMap}
                  onFactsheetClick={setSelectedFactsheetId}
                />
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-accent-600" />
            </div>
            <div className="bg-gray-100 px-4 py-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-1 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your data…"
            disabled={loading}
            className="flex-1 h-10 px-3 border border-gray-300 bg-white text-primary-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Model: {settings.llmModel} · Queries data on demand via tool calls
        </p>
      </div>

      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
