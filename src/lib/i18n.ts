/**
 * The UI is in Polish. Polish nouns take one of three forms after a number:
 * 1 noc, 2–4 noce (also 22–24, 32–34…), 5+ nocy (also 12–14, 25–31…).
 */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const abs = Math.abs(count);
  if (abs === 1) return one;
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** "1 noc", "3 noce", "5 nocy" */
export function nightsLabel(count: number): string {
  return `${count} ${plural(count, ["noc", "noce", "nocy"])}`;
}

/** "wrzesień 2026" -> "Wrzesień 2026" (Intl gives lowercase Polish month and day names). */
export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase("pl-PL") + text.slice(1);
}
