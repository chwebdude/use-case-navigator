import { CheckCircle2 } from "lucide-react";

interface VerifiedCheckProps {
  className?: string;
}

export default function VerifiedCheck({ className = "" }: VerifiedCheckProps) {
  return (
    <CheckCircle2
      className={`h-5 w-5 text-green-500 ${className}`}
      fill="currentColor"
      stroke="white"
      strokeWidth={2.5}
      aria-label="Verified"
    />
  );
}
