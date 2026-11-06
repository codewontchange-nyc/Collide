// Money helpers. Everything is integer cents until it reaches a screen.

function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Whole dollars, rounded: 184050 -> "$1,841", -1200 -> "-$12". */
export function fmt(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const dollars = Math.round(Math.abs(cents) / 100);
  return `${sign}$${group(dollars)}`;
}

/** Exact: 184050 -> "$1,840.50". */
export function fmtExact(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}$${group(whole)}.${rest < 10 ? `0${rest}` : rest}`;
}

/** Dollars to cents, rounded to the cent. */
export function dollars(n: number): number {
  return Math.round(n * 100);
}

/** "$149 a month" */
export function fmtPerMonth(cents: number): string {
  return `${fmt(cents)} a month`;
}
