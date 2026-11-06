import type { SVGProps } from "react";

const PATHS: Record<string, string> = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  budget: "M4 7h16v11H4zM4 11h16M8 15h3",
  needs: "M6 12h12M12 6v12M4 4h16v16H4z",
  colony: "M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  you: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.5 3.6-6 8-6s8 2.5 8 6",
  today: "M5 6h14v13H5zM5 10h14M9 4v4M15 4v4",
  earnings: "M4 18 9 12l4 3 7-8M4 20h16",
  availability: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4l3 2",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 12.5 10 17l9-10",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4l3 2",
  back: "M15 5l-7 7 7 7",
  chev: "M9 5l7 7-7 7",
  pin: "M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z",
  install: "M12 4v11M7 10l5 5 5-5M5 20h14",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  share: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
  leaf: "M5 19C7 9 13 5 20 4c-1 7-5 13-15 15zM5 19l8-8",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
