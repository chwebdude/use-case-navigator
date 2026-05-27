import { toPng } from "html-to-image";

interface ExportElementToPngOptions {
  fileName: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  targetScale?: number;
  style?: Partial<CSSStyleDeclaration>;
}

const DEFAULT_TARGET_SCALE = 4;
const MAX_LONG_EDGE_PX = 12000;
const MAX_TOTAL_PIXELS = 80_000_000;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSafeScale(
  width: number,
  height: number,
  targetScale: number,
): number {
  const longEdge = Math.max(width, height);
  const basePixels = width * height;

  if (longEdge <= 0 || basePixels <= 0) {
    return 1;
  }

  const scaleByEdge = MAX_LONG_EDGE_PX / longEdge;
  const scaleByPixels = Math.sqrt(MAX_TOTAL_PIXELS / basePixels);

  return clamp(
    Math.min(targetScale, scaleByEdge, scaleByPixels),
    1,
    targetScale,
  );
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

export async function exportElementToPng(
  element: HTMLElement,
  options: ExportElementToPngOptions,
): Promise<void> {
  const width = Math.max(
    1,
    Math.round(options.width ?? element.scrollWidth ?? element.clientWidth),
  );
  const height = Math.max(
    1,
    Math.round(options.height ?? element.scrollHeight ?? element.clientHeight),
  );
  const targetScale = options.targetScale ?? DEFAULT_TARGET_SCALE;
  const pixelRatio = computeSafeScale(width, height, targetScale);

  const dataUrl = await toPng(element, {
    cacheBust: true,
    backgroundColor: options.backgroundColor ?? "#ffffff",
    width,
    height,
    pixelRatio,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      ...options.style,
    },
  });

  triggerDownload(dataUrl, options.fileName);
}
