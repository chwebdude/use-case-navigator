import { useEffect, useState } from "react";
import { Check, Link as LinkIcon, TriangleAlert } from "lucide-react";
import { Button } from "./ui";

type CopyState = "idle" | "copied" | "error";

interface CopyPermalinkButtonProps {
  factsheetId: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}

export default function CopyPermalinkButton({
  factsheetId,
  size = "md",
  variant = "secondary",
  className,
}: CopyPermalinkButtonProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const permalink = `${window.location.origin}/factsheets/${factsheetId}`;

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyState]);

  const handleCopyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(permalink);
      setCopyState("copied");
    } catch (error) {
      console.error("Failed to copy factsheet permalink", error);
      setCopyState("error");
    }
  };

  const icon =
    copyState === "copied" ? (
      <Check className="w-4 h-4" />
    ) : copyState === "error" ? (
      <TriangleAlert className="w-4 h-4" />
    ) : (
      <LinkIcon className="w-4 h-4" />
    );

  const buttonLabel =
    copyState === "copied"
      ? "Permalink copied"
      : copyState === "error"
        ? "Copy permalink failed"
        : "Copy permalink";

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={icon}
      onClick={() => void handleCopyPermalink()}
      className={`px-2 ${className ?? ""}`}
      title={buttonLabel}
      aria-label={buttonLabel}
    />
  );
}
