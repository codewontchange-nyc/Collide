import type { HTMLAttributes } from "react";
import { useCountUp } from "@/system/motion";

type FigureSize = "sm" | "md" | "lg";

type FigureProps = {
  /** a number is formatted; a string renders as is (the invite code) */
  value: number | string;
  /** default String; screens pass fmt from domain/money */
  format?: (value: number) => string;
  /** sans (default, 600 tabular); mono exists for one thing, a code, never for money, counts or dates */
  family?: "sans" | "mono";
  /** headline-small 16 (rows), headline-medium 32 (strip, sheet), headline-large 56 (hero) */
  size?: FigureSize;
  /** the mono unit chip ("A MONTH", "THIS MONTH") */
  unit?: string;
  /** hero figures pass true; counts up over the slow duration on the editorial curve */
  countUp?: boolean;
  /** secondary for a spend in a ledger */
  tone?: "ink" | "secondary";
  /** with signed: auto prefixes + or - by the value's sign; "+" or "-" forces it for a ledger row whose cents are always positive */
  sign?: "auto" | "none" | "+" | "-";
  /** default false; a bare figure never carries a sign */
  signed?: boolean;
  as?: "span" | "p" | "dd";
  className?: string;
} & HTMLAttributes<HTMLElement>;

const TYPE: Record<FigureSize, string> = { sm: "headline-small", md: "headline-medium", lg: "headline-large" };

/** The sign a numeric value carries, or nothing. The sign is applied to the absolute value so "-" never doubles. */
function signOf(value: number, signed: boolean, sign: FigureProps["sign"]): string {
  if (!signed || sign === "none") return "";
  if (sign === "+" || sign === "-") return sign;
  if (value > 0) return "+";
  if (value < 0) return "-";
  return "";
}

function text(value: number, format: (v: number) => string, signed: boolean, sign: FigureProps["sign"]): string {
  const s = signOf(value, signed, sign);
  return s ? `${s}${format(Math.abs(value))}` : format(value);
}

/** A number counted up: the hook lives in its own component so a static figure never animates. */
function Counted({ value, format, signed, sign }: { value: number; format: (v: number) => string; signed: boolean; sign: FigureProps["sign"] }) {
  const shown = useCountUp(value);
  return <>{text(shown, format, signed, sign)}</>;
}

/** Headline numerals with tabular nums and a unit chip. Every figure is sans 600 tabular, in rows too. */
export function Figure({
  value,
  format = String,
  family = "sans",
  size = "md",
  unit,
  countUp = false,
  tone = "ink",
  sign = "auto",
  signed = false,
  as: Tag = "span",
  className,
  ...rest
}: FigureProps) {
  const cls = ["ig-figure", `ig-figure--${size}`, family === "mono" ? "ig-figure--mono" : "", tone === "secondary" ? "ig-figure--secondary" : "", className]
    .filter(Boolean)
    .join(" ");
  const shown = typeof value === "number" ? (countUp ? <Counted value={value} format={format} signed={signed} sign={sign} /> : text(value, format, signed, sign)) : value;
  return (
    <Tag className={cls} {...rest}>
      <span className={`ig-figure__value ${TYPE[size]} tnum`}>{shown}</span>
      {unit && <span className="ig-figure__unit label-small">{unit}</span>}
    </Tag>
  );
}
