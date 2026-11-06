export function Empty({ line, hint }: { line: string; hint?: string }) {
  return (
    <div className="empty">
      <p className="voice">{line}</p>
      {hint && <p className="small">{hint}</p>}
    </div>
  );
}
