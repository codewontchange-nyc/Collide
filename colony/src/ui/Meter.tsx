export function Meter({ parts }: { parts: { cls: string; value: number }[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0) || 1;
  return (
    <div className="meter" role="img" aria-label="budget split">
      {parts.map((p) => (
        <span key={p.cls} className={p.cls} style={{ width: `${(Math.max(0, p.value) / total) * 100}%` }} />
      ))}
    </div>
  );
}
