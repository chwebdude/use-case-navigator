interface BuildDocumentTitleParams {
  appTitle: string;
  pageTitle?: string;
  factsheetName?: string;
}

export function buildDocumentTitle({
  appTitle,
  pageTitle,
  factsheetName,
}: BuildDocumentTitleParams): string {
  const segments = [factsheetName, pageTitle, appTitle].filter(
    (segment): segment is string => Boolean(segment && segment.trim()),
  );
  return segments.join(" - ");
}

export function getPageTitleForPath(pathname: string): string | undefined {
  if (pathname === "/") {
    return "Dashboard";
  }

  if (pathname === "/give-me-power") {
    return "Admin Power";
  }

  if (pathname === "/dependencies") {
    return "Dependencies";
  }

  if (pathname === "/matrix") {
    return "Matrix View";
  }

  if (pathname === "/matrix/print") {
    return "Matrix Print";
  }

  if (pathname === "/spider") {
    return "Spider Diagram";
  }

  if (pathname === "/scatter") {
    return "Scatter Plot";
  }

  if (pathname === "/impact") {
    return "Impact Analysis";
  }

  if (pathname === "/chat") {
    return "Chat";
  }

  if (pathname === "/settings") {
    return "Settings";
  }

  if (pathname === "/factsheets") {
    return "Factsheets";
  }

  if (!pathname.startsWith("/factsheets/")) {
    return undefined;
  }

  const [, , id, section, subSection] = pathname.split("/");
  if (!id || id === "new") {
    return "New Factsheet";
  }

  if (!section) {
    return "Factsheet";
  }

  if (section === "edit") {
    return "Edit Factsheet";
  }

  if (section === "properties") {
    return "Factsheet Properties";
  }

  if (section === "print") {
    return "Factsheet Print";
  }

  if (section === "print-full") {
    return "Factsheet Full Print";
  }

  if (section === "dependencies" && subSection === "new") {
    return "New Dependency";
  }

  if (section === "dependencies" && subSection === "print") {
    return "Dependencies Print";
  }

  if (section === "dependencies" && subSection === "print-chain") {
    return "Dependencies Chain Print";
  }

  return "Factsheet";
}
