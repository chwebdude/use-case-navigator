interface MetricBadgeProps {
  name: string;
  score: number;
  maxScore?: number;
  variant?: "default" | "compact" | "detailed";
}

export function MetricBadge({
  name,
  score,
  maxScore = 10,
  variant = "default",
}: MetricBadgeProps) {
  const percentage = Math.min(100, (score / maxScore) * 100);

  // Color coding based on score percentage
  const getColorClasses = () => {
    if (percentage >= 80) {
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        fill: "bg-emerald-500",
        glow: "shadow-emerald-200/50",
      };
    } else if (percentage >= 60) {
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-700",
        fill: "bg-green-500",
        glow: "shadow-green-200/50",
      };
    } else if (percentage >= 40) {
      return {
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-700",
        fill: "bg-yellow-500",
        glow: "shadow-yellow-200/50",
      };
    } else if (percentage >= 20) {
      return {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
        fill: "bg-orange-500",
        glow: "shadow-orange-200/50",
      };
    } else {
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        fill: "bg-red-500",
        glow: "shadow-red-200/50",
      };
    }
  };

  const colors = getColorClasses();

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colors.bg} ${colors.border} ${colors.text}`}
      >
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs font-bold">{score.toFixed(1)}</span>
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div
        className={`flex flex-col gap-2 p-4 rounded-lg border ${colors.bg} ${colors.border} shadow-sm ${colors.glow}`}
      >
        <div className="flex items-center justify-between">
          <span className={`font-semibold ${colors.text}`}>{name}</span>
          <span className={`text-2xl font-bold ${colors.text}`}>
            {score.toFixed(1)}
            <span className="text-sm font-normal opacity-60">/{maxScore}</span>
          </span>
        </div>
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 ${colors.fill} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 text-right">
          {percentage.toFixed(0)}% of maximum
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`inline-flex flex-col gap-1.5 px-4 py-2 rounded-lg border ${colors.bg} ${colors.border} shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`text-sm font-semibold ${colors.text}`}>{name}</span>
        <span className={`text-lg font-bold ${colors.text}`}>
          {score.toFixed(1)}
        </span>
      </div>
      <div className="relative h-1.5 bg-white/50 rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${colors.fill} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
