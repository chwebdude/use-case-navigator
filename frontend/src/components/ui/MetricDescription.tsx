interface MetricDescriptionProps {
  description?: string;
  className?: string;
  maxLength?: number;
}

export function MetricDescription({
  description,
  className = "text-xs text-gray-500 line-clamp-1",
  maxLength = 80,
}: MetricDescriptionProps) {
  const normalizedDescription = description?.trim();
  if (!normalizedDescription) return null;

  const isTrimmed = normalizedDescription.length > maxLength;
  const displayDescription = isTrimmed
    ? `${normalizedDescription.slice(0, maxLength).trimEnd()}…`
    : normalizedDescription;

  return (
    <p
      className={className}
      title={isTrimmed ? normalizedDescription : undefined}
    >
      {displayDescription}
    </p>
  );
}
