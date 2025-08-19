export default function SectorFilter({
  sectors,
  selected,
  onChange,
  label = "Filter by sector",
}: {
  sectors: string[];
  selected: string;
  onChange: (val: string) => void;
  label?: string;
}) {
  const id = "sector-select";

  // Normalize input → trim, map falsy to "Unknown", de-dupe, sort
  const normalized = sectors
    .map((s) => (s && s.trim() ? s.trim() : "Unknown"))
    .filter(Boolean);

  const uniqueSorted = Array.from(new Set(normalized)).sort();

  // Ensure "All" is first, regardless of presence
  const options = uniqueSorted[0] === "All" ? uniqueSorted : ["All", ...uniqueSorted];

  // If current selected isn't in options (e.g., first render), keep it visible
  const finalOptions = options.includes(selected) ? options : [selected, ...options];

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mr-3 font-medium text-sm">
        {label}:
      </label>
      <select
        id={id}
        className="px-3 py-2 rounded-md border bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        {finalOptions.map((sector) => (
          <option key={sector} value={sector}>
            {sector}
          </option>
        ))}
      </select>
    </div>
  );
}