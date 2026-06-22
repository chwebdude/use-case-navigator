import { execFileSync } from "node:child_process";

const featureFixPrefixes = ["frontend/src/"];
const e2ePattern =
  /^frontend\/tests\/e2e\/.+\.(spec|test)\.(ts|tsx|js|jsx)$/;

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function normalizePaths(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function getChangedFiles() {
  const changedFromHead = normalizePaths(runGit(["diff", "--name-only", "HEAD"]));
  const untracked = normalizePaths(
    runGit(["ls-files", "--others", "--exclude-standard"]),
  );

  return [...new Set([...changedFromHead, ...untracked])];
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function hasFeatureOrFixCodeChanges(paths) {
  return paths.some((path) =>
    featureFixPrefixes.some((prefix) => path.startsWith(prefix)),
  );
}

function hasPlaywrightSpecChanges(paths) {
  return paths.some((path) => e2ePattern.test(path));
}

function main() {
  const changedFiles = getChangedFiles();
  const codeChanged = hasFeatureOrFixCodeChanges(changedFiles);
  const e2eChanged = hasPlaywrightSpecChanges(changedFiles);

  if (codeChanged && !e2eChanged) {
    printJson({
      continue: false,
      stopReason: "Playwright coverage required for frontend feature/fix changes.",
      systemMessage:
        "Frontend code under frontend/src changed, but no Playwright e2e spec changed under frontend/tests/e2e. Add or update Playwright tests in the same change.",
    });
    process.exit(2);
  }

  printJson({
    continue: true,
    systemMessage: "Playwright coverage hook check passed.",
  });
}

main();
