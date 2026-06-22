import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useRecord } from "../../hooks/useRealtime";
import { buildDocumentTitle, getPageTitleForPath } from "../../lib/documentTitle";
import type { Factsheet } from "../../types";

interface PageTitleManagerProps {
  appTitle: string;
}

export default function PageTitleManager({ appTitle }: PageTitleManagerProps) {
  const { pathname } = useLocation();

  const factsheetId = useMemo(() => {
    const match = pathname.match(/^\/factsheets\/([^/]+)/);
    if (!match) {
      return undefined;
    }

    const candidate = match[1];
    if (candidate === "new") {
      return undefined;
    }

    return candidate;
  }, [pathname]);

  const { record: factsheet } = useRecord<Factsheet>(
    "factsheets",
    factsheetId,
  );

  const pageTitle = useMemo(() => getPageTitleForPath(pathname), [pathname]);

  useEffect(() => {
    document.title = buildDocumentTitle({
      appTitle,
      pageTitle,
      factsheetName: factsheet?.name,
    });
  }, [appTitle, pageTitle, factsheet?.name]);

  return null;
}
