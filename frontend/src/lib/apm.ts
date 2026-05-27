import {
  init as initApm,
  type ApmBase,
  type Span,
  type Transaction,
  type ErrorOptions,
} from "@elastic/apm-rum";

interface ConfigureApmOptions {
  serverUrl?: string;
  serviceName?: string;
  environment?: string;
  username?: string | null;
}

const DEFAULT_SERVICE_NAME = "use-case-navigator-frontend";
const MAX_LABEL_LENGTH = 1024;

let apmAgent: ApmBase | null = null;
let initializedServerUrl: string | null = null;

export function configureApm(options: ConfigureApmOptions) {
  const serverUrl = options.serverUrl?.trim();
  if (!serverUrl) {
    return;
  }

  if (!apmAgent) {
    apmAgent = initApm({
      serviceName: options.serviceName?.trim() || DEFAULT_SERVICE_NAME,
      serverUrl,
      environment: options.environment?.trim() || undefined,
      active: true,
      distributedTracingOrigins: [window.location.origin],
    });
    initializedServerUrl = serverUrl;
  }

  if (initializedServerUrl !== serverUrl) {
    console.warn(
      `Elastic APM is already initialized for ${initializedServerUrl}. Reload the page to apply a new APM server URL.`,
    );
  }

  setApmUsernameLabel(options.username);
}

export function setApmUsernameLabel(username?: string | null) {
  const normalizedUsername = username?.trim();
  if (!apmAgent || !normalizedUsername) {
    return;
  }

  apmAgent.addLabels({ username: normalizedUsername });
}

export function logFilterChange(params: {
  key: string;
  previousValue: unknown;
  nextValue: unknown;
  pathname?: string;
}) {
  if (!apmAgent) {
    return;
  }

  const span = apmAgent.startSpan(
    `filter.change:${params.key}`,
    "app.filter.change",
  );

  span?.addLabels({
    filter_key: toLabelValue(params.key),
    route: toLabelValue(params.pathname || window.location.pathname),
    previous_value: toLabelValue(params.previousValue),
    next_value: toLabelValue(params.nextValue),
  });
  span?.end();
}

export function startPocketbaseRequestSpan(params: {
  method: string;
  path: string;
  url?: string;
  requestBody?: unknown;
}): Span | undefined {
  if (!apmAgent) {
    return undefined;
  }

  const span = apmAgent.startSpan(
    `pocketbase ${params.method} ${params.path}`,
    "external.http.pocketbase",
  );

  span?.addLabels({
    pb_method: toLabelValue(params.method.toUpperCase()),
    pb_path: toLabelValue(params.path),
    pb_url: toLabelValue(params.url ?? ""),
    pb_request_body_summary: summarizePayload(params.requestBody),
  });

  return span;
}

export function completePocketbaseRequestSpan(params: {
  span?: Span;
  status?: number;
  responseData?: unknown;
}) {
  if (!params.span) {
    return;
  }

  params.span.addLabels({
    pb_status: params.status ?? 0,
    pb_response_summary: summarizePayload(params.responseData),
  });
  params.span.end();
}

export function captureApmError(error: Error | string, opts?: ErrorOptions) {
  apmAgent?.captureError(error, opts);
}

export function startChatRequestTransaction(params: {
  endpoint: string;
  model: string;
  messageCount: number;
  promptLength: number;
  question?: string;
}): Transaction | undefined {
  if (!apmAgent) {
    return undefined;
  }

  const transaction = apmAgent.startTransaction("chat.llm.request", "request", {
    managed: true,
  });

  transaction?.addLabels({
    llm_endpoint: toLabelValue(params.endpoint),
    llm_model: toLabelValue(params.model),
    llm_message_count: params.messageCount,
    llm_prompt_length: params.promptLength,
    llm_question: toLabelValue(params.question ?? ""),
  });

  return transaction;
}

export function completeChatRequestTransaction(params: {
  transaction?: Transaction;
  status: number;
  responseLength?: number;
}) {
  if (!params.transaction) {
    return;
  }

  params.transaction.addLabels({
    llm_status: params.status,
    llm_response_length: params.responseLength ?? 0,
  });
  params.transaction.end();
}

export function logPocketbaseRealtimeEvent(params: {
  collection: string;
  action: string;
  recordId?: string;
}) {
  if (!apmAgent) {
    return;
  }

  const span = apmAgent.startSpan(
    `pocketbase realtime ${params.action}`,
    "external.websocket.pocketbase",
  );

  span?.addLabels({
    pb_collection: toLabelValue(params.collection),
    pb_action: toLabelValue(params.action),
    pb_record_id: toLabelValue(params.recordId ?? ""),
  });
  span?.end();
}

function toLabelValue(value: unknown): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateLabel(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return truncateLabel(JSON.stringify(value));
  } catch {
    return "[unserializable]";
  }
}

function truncateLabel(value: string): string {
  return value.length > MAX_LABEL_LENGTH
    ? `${value.slice(0, MAX_LABEL_LENGTH)}...[truncated]`
    : value;
}

function summarizePayload(value: unknown): string {
  if (value === null || value === undefined) {
    return "empty";
  }

  if (typeof value === "string") {
    return `string:length=${value.length}`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${typeof value}:${String(value)}`;
  }

  if (Array.isArray(value)) {
    return `array:length=${value.length}`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return `object:keys=${keys.length}:${keys.slice(0, 10).join(",")}`;
  }

  return typeof value;
}
