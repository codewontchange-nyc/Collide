import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, type CatalogEntry, type CatalogGroup } from "@/system/catalog";
import { Screen, Rise } from "@/system/Screen/Screen";
import { PageIntro } from "@/system/PageIntro/PageIntro";
import { MetaLine } from "@/system/MetaLine/MetaLine";
import { Switch } from "@/system/Switch/Switch";
import { Sticky } from "@/system/Sticky/Sticky";
import { SearchField } from "@/system/SearchField/SearchField";
import { QuietButton } from "@/system/QuietButton/QuietButton";
import { FilterChip, ChipRow } from "@/system/FilterChip/FilterChip";
import { Panel, PanelHead } from "@/system/PanelHead/PanelHead";
import { EmptyState } from "@/system/EmptyState/EmptyState";
import { List, ListRow } from "@/system/List/List";
import { toast } from "@/system/Toast/Toast";
import { useReducedMotion } from "@/system/motion";
import { TokensSection } from "./TokensSection";

/* The /system page: the whole catalog, live, on the tokens. Everything on it is built from the system, so the page is its own test. */

const GROUPS: CatalogGroup[] = ["Foundations", "Pressables", "Marks and status", "Forms", "Feedback", "Text and heads", "Data", "Lists and cards", "People and time", "Shell"];
const TOKENS_ID = "tokens";
const MODE_KEY = "colony.system.mode";
const VERSION = "V0.1.0";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const pad = (n: number) => String(n).padStart(2, "0");

function readQuery(): string {
  try {
    return new URLSearchParams(window.location.search).get("q") ?? "";
  } catch {
    return "";
  }
}

/** The query lives in the URL so /system?q=notice is a shareable review. replaceState keeps the router's own state. */
function writeQuery(q: string) {
  try {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    history.replaceState(history.state, "", url);
  } catch {
    /* no URL to write; the search still filters */
  }
}

function readMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "dark";
  } catch {
    return false;
  }
}

function writeMode(dark: boolean) {
  try {
    localStorage.setItem(MODE_KEY, dark ? "dark" : "light");
  } catch {
    /* per viewer only; never required */
  }
}

/** Every token of the query must match the name, a variant or a task, case insensitively. */
function matches(entry: CatalogEntry, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = [entry.name, ...entry.variants, ...entry.tasks].join(" ").toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

async function copyImport(name: string) {
  const line = `import { ${name} } from "@/system";`;
  try {
    await navigator.clipboard.writeText(line);
    toast.show("Copied.", { kind: "success" });
  } catch {
    toast.show("Could not copy.", { kind: "error" });
  }
}

/* The contract's section 11, as reading rows. */
const RULES: { title: string; body: string }[] = [
  { title: "Tokens for every value", body: "No raw color anywhere in src except the favicon and the manifest. No raw duration, easing, radius or font. The raw px allowed are the few the conventions name (2, 3, the 12px touch row, glyph geometry, negative pulls) and nothing else." },
  { title: "One large radius", body: "No radius above 12px, and 12px only on Button, SearchField and the FAB. Everything else is 1px; 4px appears only on the library's glyph tiles. Circles only on dots, Steps and Avatar." },
  { title: "No shadow but the toast", body: "0 8px 24px at 16% ink, dropped for an outline in dark mode. A zero blur ring (the Avatar ring, the outlined Button, the Steps current dot, a selected ground Card) is a border, not a shadow. No blur except the glassy button." },
  { title: "Reduced motion, per file", body: "Every Name.css ends with its own reduced motion block listing its animated selectors. Scripted motion checks useReducedMotion() and renders the final frame." },
  { title: "Hover only with a pointer", body: "Hover rules live only inside @media (hover: hover). Active states run on the instant duration (100ms)." },
  { title: "Every pressable is a target", body: "Tap highlight off, touch-action manipulation, a 44px hit area by Recipe A (the box), B (the row) or C (the halo), an accessible name, and the focus ring." },
  { title: "Labels are uppercase mono", body: "label-small and label-large are tracked 0.06em or 0.05em, never tighter, never bold. Headings are sentence case and never tracked tighter than the token. Body text is never tracked." },
  { title: "Weights 400 to 600", body: "No weight above 600, none below 400. No italic; voice is carried by the serif at paragraph sizes." },
  { title: "Grey by role", body: "neutral-04 is never used for text under 16px that must be read. Counts and meta use neutral-06, secondary text neutral-08." },
  { title: "Never color alone", body: "Meaning never rides on color alone: a dot plus a word, a caret plus a hidden word, an inversion plus aria-pressed, aria-selected or aria-current." },
  { title: "One inverted block", body: "At most one inverted block per screen (an inverted Card or the companion's bubble). Today's cell, the ink Tag, the pressed chip, the dark Button, the FAB and the toast do not count." },
  { title: "Main scrolls", body: "The scroll container is main, never the window. Fixed chrome reads --nav-height, never --size-bar alone." },
  { title: "Inputs are 16px", body: "So iOS never zooms. Selects keep font-size 16px under appearance none." },
  { title: "Type by class, color by token", body: "Components set type by adding a type class, never by font properties, and reference --color-* tokens directly. There is no semantic alias layer." },
  { title: "No em dashes", body: "Not in UI copy, comments, code, markdown or commit messages. Use a comma, a period, a colon or parentheses. A lint step in npm run check fails on a hit." },
  { title: "No exclamation marks", body: "States are single capitalized nouns or participles. A missing value is \"-\", never 0." },
  { title: "Rhythm", body: "No 12px or 24px spacing except the named touch row padding. 32 between sections, 16 between blocks, 8 inside a block, 4 from a label to its value." },
  { title: "Nothing borrowed", body: "Nothing imports another design system's package or files; nothing carries another brand's copy, names or art. Glyphs are redrawn from the briefs." },
];

/** The library page. Route /system, bare (no tab bar), document.title "System, Colony". */
export function SystemLibrary() {
  const reduced = useReducedMotion();
  const [query, setQuery] = useState(readQuery);
  const [dark, setDark] = useState(readMode);
  const [inView, setInView] = useState<Set<string>>(() => new Set());
  const groupEls = useRef(new Map<string, HTMLElement>());
  const chipsRef = useRef<HTMLDivElement>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  const tokens = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const searching = tokens.length > 0;

  /* Entries grouped in the CatalogGroup order, CATALOG order inside a group; the index is the entry's place on this page. */
  const grouped = useMemo(() => GROUPS.map((group) => ({ group, entries: CATALOG.filter((e) => e.group === group) })), []);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    let i = 1;
    for (const g of grouped) for (const e of g.entries) map.set(e.id, i++);
    return map;
  }, [grouped]);
  const total = CATALOG.length;
  const shownIds = useMemo(() => new Set(CATALOG.filter((e) => matches(e, tokens)).map((e) => e.id)), [tokens]);
  const shown = shownIds.size;

  const change = (q: string) => {
    setQuery(q);
    writeQuery(q);
  };
  const clear = () => change("");

  const toggleMode = (next: boolean) => {
    setDark(next);
    writeMode(next);
  };

  /* One observer for the group sections; a chip is pressed while its group is in view. */
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ig-main");
    const io = new IntersectionObserver(
      (records) => {
        setInView((prev) => {
          const next = new Set(prev);
          for (const r of records) {
            const key = (r.target as HTMLElement).dataset.libraryGroup;
            if (!key) continue;
            if (r.isIntersecting) next.add(key);
            else next.delete(key);
          }
          return next;
        });
      },
      { root, threshold: 0 },
    );
    observer.current = io;
    for (const el of groupEls.current.values()) io.observe(el);
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, []);

  /* A callback ref per group, so a section that mounts later (tokens after a search is cleared) is observed too. */
  const register = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      const prev = groupEls.current.get(key);
      if (prev && prev !== el) {
        observer.current?.unobserve(prev);
        groupEls.current.delete(key);
        setInView((s) => {
          if (!s.has(key)) return s;
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
      if (el) {
        groupEls.current.set(key, el);
        observer.current?.observe(el);
      }
    },
    [],
  );

  /* Keep the first pressed chip in view inside the row, without scrolling the page. */
  useEffect(() => {
    const row = chipsRef.current?.querySelector<HTMLElement>(".ig-chiprow");
    if (!row) return;
    const chip = row.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!chip) return;
    const left = chip.offsetLeft - row.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: reduced ? "auto" : "smooth" });
  }, [inView, reduced]);

  const jump = (key: string) => {
    groupEls.current.get(key)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const mode = dark ? "dark" : "light";

  return (
    <Screen bare title="System">
      <Rise index={0}>
        <PageIntro
          eyebrow={<MetaLine facts={["Colony system", `${total} components`, VERSION]} />}
          aside={<Switch hideLabel label="Dark" checked={dark} onChange={toggleMode} />}
          title="Colony"
          titleMuted="System"
          intro="Every component, every variant, on the tokens. Search by name, variant or what you are trying to do."
          editorial
        />
      </Rise>

      <Sticky>
        <SearchField value={query} onChange={change} onClear={clear} label="Search components" placeholder="Search by name, variant or task" />
      </Sticky>

      <Rise index={1} className="ig-library__scope">
        <div className="ig-library__count">
          <MetaLine facts={[`${shown} of ${total} shown`]} />
          {searching && <QuietButton onClick={clear}>Clear</QuietButton>}
        </div>
        <div ref={chipsRef}>
          <ChipRow scroll label="Groups">
            {!searching && (
              <FilterChip pressed={inView.has(TOKENS_ID)} onPress={() => jump(TOKENS_ID)}>
                Tokens
              </FilterChip>
            )}
            {grouped.map(({ group, entries }) => (
              <FilterChip key={group} pressed={inView.has(group)} onPress={() => jump(group)} count={searching ? entries.filter((e) => shownIds.has(e.id)).length : undefined}>
                {group}
              </FilterChip>
            ))}
          </ChipRow>
        </div>
      </Rise>

      <Rise index={2}>
        <div className="ig-library" data-mode={dark ? "dark" : undefined}>
          {!searching && (
            <section className="ig-library__group" id="library-tokens" aria-labelledby="library-tokens-head" ref={register(TOKENS_ID)} data-library-group={TOKENS_ID}>
              <Panel>
                <PanelHead index="00" title="Tokens" rule="ink" id="library-tokens-head" description="Color, type, spacing, radius, easing and duration. Flip the Dark switch to see the ladder mirror." />
                <TokensSection mode={mode} />
              </Panel>
            </section>
          )}

          {shown === 0 ? (
            <EmptyState query={query} onClear={clear} />
          ) : (
            grouped.map(({ group, entries }) => {
              const visible = entries.filter((e) => shownIds.has(e.id));
              const headId = `library-${slug(group)}`;
              return (
                <section key={group} className="ig-library__group" id={headId} aria-labelledby={`${headId}-head`} ref={register(group)} data-library-group={group}>
                  <PanelHead title={group} meta={`${visible.length} of ${entries.length}`} rule="ink" id={`${headId}-head`} />
                  {visible.map((entry) => (
                    <Entry key={entry.id} entry={entry} index={indexOf.get(entry.id) ?? 0} />
                  ))}
                </section>
              );
            })
          )}
        </div>
      </Rise>

      <Rise index={3}>
        <Panel aria-labelledby="library-rules">
          <PanelHead title="Rules" meta={`${RULES.length} rules`} rule="ink" id="library-rules" description="What every file in the system follows. The page above is built on them." />
          <List rule="none" density="reading" as="ol">
            {RULES.map((rule, i) => (
              <ListRow key={rule.title} index={pad(i + 1)} title={rule.title} titleAs="h3" facts={rule.body} />
            ))}
          </List>
        </Panel>
      </Rise>
    </Screen>
  );
}

/** One catalog entry: the head with the page index, the group, COPY, the tasks; then the live specimens in the grid. */
function Entry({ entry, index }: { entry: CatalogEntry; index: number }) {
  const headId = `library-entry-${entry.id}`;
  return (
    <Panel className="ig-library__entry" aria-labelledby={headId}>
      <PanelHead
        index={pad(index)}
        title={entry.name}
        meta={entry.group}
        headingLevel={3}
        id={headId}
        description={entry.tasks.join(", ")}
        action={
          <QuietButton icon="copy" onClick={() => void copyImport(entry.name)} aria-label={`Copy the import line for ${entry.name}`}>
            Copy
          </QuietButton>
        }
      />
      <div className="ig-library__specimens">{entry.render()}</div>
    </Panel>
  );
}
