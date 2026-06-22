import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, AlertCircle, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Button } from "../components/ui";
import { Card, CardTitle } from "../components/ui";
import ChatChart, { parseChartBlocks } from "../components/ChatChart";
import FactsheetDetailModal from "../components/FactsheetDetailModal";
import { useAppSettings } from "../hooks/useAppSettings";
import {
  captureApmError,
  completeChatRequestTransaction,
  startChatRequestTransaction,
} from "../lib/apm";
import pb from "../lib/pocketbase";
import { getStatusMeta, normalizeStatuses } from "../lib/statusConfig";
import type {
  Factsheet,
  FactsheetType,
  Dependency,
  Metric,
  PropertyDefinition,
  PropertyOption,
  FactsheetProperty,
  StatusDefinition,
} from "../types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function resolveStatusLabel(
  f: Factsheet,
  globalStatuses: StatusDefinition[] | undefined,
  typeObj?: FactsheetType,
): string {
  const statusId = f.status_id || f.status;
  return getStatusMeta(statusId, globalStatuses, typeObj).label;
}

async function loadDataContext(): Promise<{
  context: string;
  factsheetMap: Map<string, string>;
}> {
  const [
    factsheets,
    types,
    dependencies,
    metrics,
    properties,
    options,
    fpLinks,
    appSettingsRecords,
  ] = await Promise.all([
    pb.collection("factsheets").getFullList<Factsheet>(),
    pb.collection("factsheet_types").getFullList<FactsheetType>(),
    pb.collection("dependencies").getFullList<Dependency>(),
    pb
      .collection("metrics")
      .getFullList<Metric>({ expand: "properties", sort: "order,name" }),
    pb.collection("property_definitions").getFullList<PropertyDefinition>(),
    pb.collection("property_options").getFullList<PropertyOption>(),
    pb.collection("factsheet_properties").getFullList<FactsheetProperty>(),
    pb.collection("app_settings").getFullList(),
  ]);

  const globalStatuses =
    appSettingsRecords.length > 0
      ? normalizeStatuses(appSettingsRecords[0].statuses)
      : undefined;

  const typeMap = Object.fromEntries(types.map((t) => [t.id, t.name]));
  const typeObjMap = Object.fromEntries(types.map((t) => [t.id, t]));
  const fsMap = Object.fromEntries(factsheets.map((f) => [f.id, f.name]));
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p.name]));
  const optMap = Object.fromEntries(options.map((o) => [o.id, o]));
  const factsheetPropertyLookup = new Map<
    string,
    Map<string, FactsheetProperty>
  >();
  fpLinks.forEach((fp) => {
    if (!factsheetPropertyLookup.has(fp.factsheet)) {
      factsheetPropertyLookup.set(fp.factsheet, new Map());
    }
    factsheetPropertyLookup.get(fp.factsheet)!.set(fp.property, fp);
  });

  const computeMetricScore = (
    factsheetId: string,
    metric: Metric,
  ): number | null => {
    const metricProperties = metric.properties?.length
      ? metric.properties
      : ((
          metric as Metric & { expand?: { properties?: PropertyDefinition[] } }
        ).expand?.properties?.map((p) => p.id) ?? []);
    if (metricProperties.length === 0) return null;

    const fsProps = factsheetPropertyLookup.get(factsheetId);
    if (!fsProps) return null;

    let sum = 0;
    let count = 0;
    metricProperties.forEach((propertyId) => {
      const selectedProperty = fsProps.get(propertyId);
      if (!selectedProperty) return;
      const selectedOption = optMap[selectedProperty.option];

      const weight =
        typeof selectedOption?.weight === "number" ? selectedOption.weight : 0;
      sum += weight;
      count += 1;
    });

    if (count === 0) return null;
    return sum / count;
  };

  const lines: string[] = [];

  // Summary with exact counts
  const statusCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const typeStatusCounts: Record<string, Record<string, number>> = {};
  let verifiedCount = 0;
  for (const f of factsheets) {
    const label = resolveStatusLabel(f, globalStatuses, typeObjMap[f.type]);
    statusCounts[label] = (statusCounts[label] || 0) + 1;
    const typeName = typeMap[f.type] || f.type;
    typeCounts[typeName] = (typeCounts[typeName] || 0) + 1;
    if (!typeStatusCounts[typeName]) typeStatusCounts[typeName] = {};
    typeStatusCounts[typeName][label] =
      (typeStatusCounts[typeName][label] || 0) + 1;
    if (f.reviewed) verifiedCount += 1;
  }

  lines.push(
    "## Summary (exact counts — use these for any counting questions)",
  );
  lines.push(`- Total factsheets: ${factsheets.length}`);
  lines.push(`- Total factsheet types: ${types.length}`);
  lines.push(`- Total dependencies: ${dependencies.length}`);
  lines.push(`- Total metrics: ${metrics.length}`);
  lines.push(`- Total property definitions: ${properties.length}`);
  lines.push(`- Verified factsheets: ${verifiedCount}`);
  lines.push(`- Unverified factsheets: ${factsheets.length - verifiedCount}`);
  lines.push(
    `- Factsheets by status: ${Object.entries(statusCounts)
      .map(([s, c]) => `${s}: ${c}`)
      .join(", ")}`,
  );
  lines.push(
    `- Factsheets by type: ${Object.entries(typeCounts)
      .map(([t, c]) => `${t}: ${c}`)
      .join(", ")}`,
  );
  lines.push("\n### Factsheets by type and status (use for filtered counts):");
  for (const [typeName, statuses] of Object.entries(typeStatusCounts)) {
    const breakdown = Object.entries(statuses)
      .map(([s, c]) => `${s}: ${c}`)
      .join(", ");
    lines.push(`- ${typeName}: ${breakdown}`);
  }

  lines.push("\n## Factsheet Types");
  for (const t of types) {
    lines.push(`- ${t.name}`);
  }

  lines.push("\n## Factsheets");
  for (const f of factsheets) {
    const typeName = typeMap[f.type] || f.type;
    const statusLabel = resolveStatusLabel(
      f,
      globalStatuses,
      typeObjMap[f.type],
    );
    lines.push(`- "${f.name}" (type: ${typeName}, status: ${statusLabel})`);
    lines.push(`  Verified: ${f.reviewed ? "yes" : "no"}`);
    if (f.review_comment)
      lines.push(`  Verification comment: ${f.review_comment}`);
    if (f.reviewed_by) lines.push(`  Verified by: ${f.reviewed_by}`);
    if (f.reviewed_at) lines.push(`  Verified at: ${f.reviewed_at}`);
    if (f.description) lines.push(`  Description: ${f.description}`);
    if (f.responsibility) lines.push(`  Responsibility: ${f.responsibility}`);
    if (f.what_it_does) lines.push(`  What it does: ${f.what_it_does}`);
    if (f.benefits) lines.push(`  Benefits: ${f.benefits}`);

    if (metrics.length > 0) {
      const metricValues = metrics
        .map((metric) => {
          const score = computeMetricScore(f.id, metric);
          return score === null ? null : `${metric.name}: ${score.toFixed(2)}`;
        })
        .filter((entry): entry is string => entry !== null);
      if (metricValues.length > 0) {
        lines.push(`  Calculated metrics: ${metricValues.join(", ")}`);
      }
    }
  }

  lines.push("\n## Metrics");
  for (const m of metrics) {
    const metricProperties = m.properties?.length
      ? m.properties
      : ((
          m as Metric & { expand?: { properties?: PropertyDefinition[] } }
        ).expand?.properties?.map((p) => p.id) ?? []);
    const propertyNames = metricProperties
      .map((pid) => propMap[pid] || pid)
      .join(", ");
    lines.push(`- ${m.name}: uses properties [${propertyNames}]`);
    if (m.description) lines.push(`  Description: ${m.description}`);
  }

  lines.push("\n## Dependencies");
  for (const d of dependencies) {
    const from = fsMap[d.factsheet] || d.factsheet;
    const to = fsMap[d.depends_on] || d.depends_on;
    lines.push(
      `- "${from}" depends on "${to}"${d.description ? ` (${d.description})` : ""}`,
    );
  }

  lines.push("\n## Property Definitions & Options");
  for (const p of properties) {
    const opts = options
      .filter((o) => o.property === p.id)
      .map((o) => o.value)
      .join(", ");
    lines.push(`- ${p.name}: [${opts}]`);
  }

  lines.push("\n## Factsheet Properties");
  for (const fp of fpLinks) {
    const fsName = fsMap[fp.factsheet] || fp.factsheet;
    const propName = propMap[fp.property] || fp.property;
    const opt = optMap[fp.option];
    const optValue = opt ? opt.value : fp.option;
    lines.push(`- "${fsName}" → ${propName}: ${optValue}`);
  }

  const factsheetMap = new Map(factsheets.map((f) => [f.name, f.id]));
  return { context: lines.join("\n"), factsheetMap };
}

async function sendChatRequest(
  messages: ChatMessage[],
  dataContext: string,
  endpoint: string,
  apiKey: string,
  model: string,
): Promise<string> {
  const systemPrompt = `You are a helpful assistant for the "Use Case Navigator" application. You answer questions about the data (factsheets, dependencies, properties, metrics) managed in the system.

Here is the current data in the system:

${dataContext}

IMPORTANT: The "Summary" section at the top contains pre-computed exact counts. Always use those numbers for counting questions (e.g. "how many factsheets", "how many dependencies"). Do NOT try to count items yourself from the lists below — use the summary numbers. The "Factsheets by type and status" subsection has exact cross-tabulated counts for each type-status combination.

Use the factsheet "Verified" field for verification logic. Treat "verified" and "reviewed" as the same concept when users ask filtering/counting questions.

When listing items that match a filter (e.g. "Data Foundations with Unknown status"), first check the summary for the exact count, then carefully list ALL matching items from the data. Verify your list has the correct number of items before responding.

When a user asks about a specific factsheet, include its calculated metric values (if available) in the answer.

When your answer involves numerical data that would benefit from visualization (distributions, comparisons, counts by category), include a chart by adding a fenced code block with the language "chart" containing a JSON object. The JSON must have:
- "type": one of "bar", "horizontal-bar", or "pie"
- "title": a short chart title
- "data": an array of {"label": string, "value": number} objects

Example:
\`\`\`chart
{"type": "bar", "title": "Factsheets by Type", "data": [{"label": "Use Case", "value": 10}, {"label": "Platform", "value": 5}]}
\`\`\`

Always include the chart AFTER a brief text explanation. Use "pie" for proportions/shares, "bar" for comparisons with few categories, and "horizontal-bar" when there are many categories or long labels.

Answer questions based on this data. Be concise and specific. If asked about dependencies, trace the dependency chains. If asked about statistics, use the summary counts or compute from the data. If asked about metric values, use the provided calculated metric values from the factsheet data. Format your answers with markdown when appropriate.`;

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    temperature: 0,
  };

  const baseUrl = endpoint.replace(/\/+$/, "");
  const url = baseUrl.includes("/chat/completions")
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;

  const transaction = startChatRequestTransaction({
    endpoint: url,
    model,
    messageCount: messages.length,
    promptLength: body.messages.reduce(
      (sum, message) => sum + (message.content?.length ?? 0),
      0,
    ),
    question:
      messages.length > 0 ? messages[messages.length - 1].content : undefined,
  });
  let requestStatus = 0;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    requestStatus = response.status;

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content =
      data.choices?.[0]?.message?.content || "No response from model.";
    completeChatRequestTransaction({
      transaction,
      status: requestStatus,
      responseLength: content.length,
    });
    return content;
  } catch (error) {
    completeChatRequestTransaction({
      transaction,
      status: requestStatus,
    });

    captureApmError(error instanceof Error ? error : "Chat request failed", {
      labels: {
        llm_endpoint: url,
        llm_model: model,
        llm_message_count: messages.length,
      },
    });

    throw error;
  }
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

function AssistantMessage({
  content,
  factsheetMap,
  onFactsheetClick,
}: {
  content: string;
  factsheetMap: Map<string, string>;
  onFactsheetClick: (id: string) => void;
}) {
  const parts = parseChartBlocks(content);

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
  const [dataContext, setDataContext] = useState<string | null>(null);
  const [factsheetMap, setFactsheetMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [selectedFactsheetId, setSelectedFactsheetId] = useState<string | null>(
    null,
  );
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConfigured =
    settings.llmEndpoint && settings.llmApiKey && settings.llmModel;

  useEffect(() => {
    loadDataContext()
      .then(({ context, factsheetMap: fm }) => {
        setDataContext(context);
        setFactsheetMap(fm);
      })
      .catch((err) => {
        console.error("Failed to load data context:", err);
        setError("Failed to load application data for chat context.");
      })
      .finally(() => setDataLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !isConfigured || !dataContext) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const reply = await sendChatRequest(
        updatedMessages,
        dataContext,
        settings.llmEndpoint!,
        settings.llmApiKey!,
        settings.llmModel!,
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, isConfigured, dataContext, messages, settings]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
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
        {dataLoading && (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading application data…
          </div>
        )}

        {!dataLoading && messages.length === 0 && (
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
            <div
              className={`max-w-[75%] px-4 py-3 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-accent-500 text-white whitespace-pre-wrap"
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
            disabled={loading || dataLoading}
            className="flex-1 h-10 px-3 border border-gray-300 bg-white text-primary-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading || dataLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Model: {settings.llmModel} · Data is loaded fresh each session
        </p>
      </div>

      <FactsheetDetailModal
        factsheetId={selectedFactsheetId}
        onClose={() => setSelectedFactsheetId(null)}
      />
    </div>
  );
}
