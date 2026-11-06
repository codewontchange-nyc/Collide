import { useState } from "react";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, src, size = "md" }: { name: string; src?: string; size?: "xs" | "sm" | "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const cls = ["avatar", size !== "md" ? size : ""].filter(Boolean).join(" ");
  return (
    <span className={cls} title={name} aria-label={name}>
      {src && !broken ? <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

export function Faces({ people, size = "sm" }: { people: { name: string; avatar?: string }[]; size?: "xs" | "sm" | "md" }) {
  return (
    <span className="faces">
      {people.map((p) => (
        <Avatar key={p.name} name={p.name} src={p.avatar} size={size} />
      ))}
    </span>
  );
}
