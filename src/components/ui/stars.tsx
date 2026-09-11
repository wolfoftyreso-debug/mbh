export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1 text-ink-2" aria-label={`${value.toFixed(1)} out of 5`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= rounded ? "currentColor" : i - 0.5 === rounded ? "url(#half)" : "none"} stroke="currentColor" strokeWidth="1.5" className={i <= rounded ? "text-warn" : "text-line-strong"}>
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </span>
      {count !== undefined ? (
        <span className="text-xs">
          {value ? value.toFixed(1) : "–"} ({count})
        </span>
      ) : null}
    </span>
  );
}
