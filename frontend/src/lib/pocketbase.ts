import PocketBase, { type SendOptions } from "pocketbase";
import {
  captureApmError,
  completePocketbaseRequestSpan,
  startPocketbaseRequestSpan,
} from "./apm";

const getPocketbaseUrl = () => {
  // Use env variable if set, otherwise use the current host/port as fallback
  if (import.meta.env.VITE_POCKETBASE_URL) {
    return import.meta.env.VITE_POCKETBASE_URL;
  }
  // Use current hostname as fallback
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}`;
};

const pb = new PocketBase(getPocketbaseUrl());

// Enable auto-cancellation for requests
pb.autoCancellation(false);

const originalBeforeSend = pb.beforeSend;
pb.beforeSend = async (url: string, options: SendOptions) => {
  const next = originalBeforeSend
    ? await originalBeforeSend(url, options)
    : { url, options };

  return {
    url: next?.url ?? url,
    options: next?.options ?? options,
  };
};

const originalAfterSend = pb.afterSend;
pb.afterSend = (response: Response, data: unknown, options?: SendOptions) => {
  const processedData = originalAfterSend
    ? options
      ? originalAfterSend(response, data, options)
      : originalAfterSend(response, data)
    : data;

  return processedData;
};

const originalSend = pb.send.bind(pb);
pb.send = async <T = unknown>(
  path: string,
  options: SendOptions,
): Promise<T> => {
  const method = options?.method ?? "GET";
  const span = startPocketbaseRequestSpan({
    method,
    path,
    url: pb.buildURL(path),
    requestBody: options?.body,
  });

  try {
    const result = await originalSend<T>(path, options);
    completePocketbaseRequestSpan({
      span,
      status: 200,
      responseData: result,
    });
    return result;
  } catch (error) {
    const errorObject = error as {
      status?: number;
      response?: unknown;
      message?: string;
    };

    completePocketbaseRequestSpan({
      span,
      status: errorObject.status ?? 0,
      responseData: errorObject.response,
    });

    captureApmError(errorObject.message || "PocketBase request failed", {
      labels: {
        pb_method: method,
        pb_path: path,
        pb_status: errorObject.status ?? 0,
      },
    });

    throw error;
  }
};

export default pb;
