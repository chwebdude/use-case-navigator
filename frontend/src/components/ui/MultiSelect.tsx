import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: MultiSelectOption[];
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

export function MultiSelect({
  label,
  error,
  hint,
  options,
  placeholder = "Select options...",
  values,
  onChange,
  className = "",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (value: string) => {
    const newValues = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
    onChange(newValues);
  };

  const selectedOptions = options.filter((option) =>
    values.includes(option.value),
  );
  const summaryText =
    selectedOptions.length === 0 ? placeholder : selectedOptions[0].label;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-primary-900 mb-0.5">
          {label}
        </label>
      )}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className={`
            w-full h-10 px-3 pr-10 border bg-white text-left
            appearance-none cursor-pointer text-sm
            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error ? "border-error focus:ring-error" : "border-gray-300"}
            ${className}
            flex items-center gap-2 overflow-hidden
          `}
        >
          {selectedOptions.length === 0 ? (
            <span className="truncate text-gray-500">{summaryText}</span>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-primary-900">
                {summaryText}
              </span>
              {selectedOptions.length > 1 && (
                <span className="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-semibold text-accent-700">
                  +{selectedOptions.length - 1}
                </span>
              )}
            </>
          )}
        </button>

        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded border border-gray-300 bg-white shadow-lg">
            <div className="max-h-64 overflow-y-auto p-2">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={values.includes(option.value)}
                    onChange={() => handleToggleOption(option.value)}
                    className="w-4 h-4 text-accent-500 border-gray-300 rounded focus:ring-accent-500"
                  />
                  <span className="text-sm text-primary-900">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-sm text-error">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-gray-500">{hint}</p>}
    </div>
  );
}
