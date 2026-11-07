import type { ReactNode } from "react";
import { IconButton } from "@/system/IconButton/IconButton";
import { Kicker } from "@/system/Kicker/Kicker";

/** The masthead, once: a trail (back, the mono eyebrow, an aside), the two tone title with its muted half on its own line,
 *  one intro sentence, a row of actions, and the under slot for the controls that scope the page.
 *  Size, decided once (contract decision 11, the brief's phone step): the title is headline-medium (32px/1) on every page, the
 *  library included; headline-large (56px) belongs to the hero figure and the welcome wordmark only. There is no size prop. A three
 *  word muted half can still take two lines at 375 (32px Geist 600 holds about 19 characters in 343px); that is the copy's budget. */
export function PageIntro({
  eyebrow,
  back,
  aside,
  title,
  titleMuted,
  headingLevel = 1,
  intro,
  editorial = false,
  actions,
  children,
  className,
}: {
  /** the place line: a string becomes a Kicker (tone secondary); a MetaLine is allowed as a node */
  eyebrow?: ReactNode;
  /** a 44px chevron-left IconButton before the eyebrow */
  back?: { label?: string; onPress?: () => void; href?: string };
  /** right slot on the trail: Companion, an Avatar md, a QuietButton, a StatusWord, a Switch */
  aside?: ReactNode;
  title: ReactNode;
  /** the muted half, on its own line; punctuation belongs to the ink half */
  titleMuted?: ReactNode;
  headingLevel?: 1 | 2;
  intro?: ReactNode;
  /** intro in Cardo: paragraph-medium, paragraph-large from 480px */
  editorial?: boolean;
  /** a row of Buttons or QuietButtons, gap 8, wraps */
  actions?: ReactNode;
  /** the under slot: Tabs, WeekStrip, a MetricStrip, SegmentedMono */
  children?: ReactNode;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  const cls = ["ig-page-intro", editorial ? "ig-page-intro--editorial" : "", className].filter(Boolean).join(" ");
  const hasTrail = back !== undefined || (eyebrow !== undefined && eyebrow !== null && eyebrow !== false) || (aside !== undefined && aside !== null && aside !== false);
  const eyebrowNode =
    eyebrow === undefined || eyebrow === null || eyebrow === false ? null : typeof eyebrow === "string" || typeof eyebrow === "number" ? (
      <Kicker className="ig-page-intro__eyebrow">{eyebrow}</Kicker>
    ) : (
      <div className="ig-page-intro__eyebrow">{eyebrow}</div>
    );
  return (
    <header className={cls}>
      {hasTrail && (
        <div className="ig-page-intro__trail">
          {back && <IconButton icon="chevron-left" label={back.label ?? "Back"} href={back.href} onClick={back.onPress} className="ig-page-intro__back" />}
          {eyebrowNode}
          {aside !== undefined && aside !== null && aside !== false && <div className="ig-page-intro__aside">{aside}</div>}
        </div>
      )}
      <div className="ig-page-intro__body">
        <Heading className="ig-page-intro__title headline-medium">
          {title}
          {titleMuted !== undefined && titleMuted !== null && titleMuted !== false && (
            <>
              {" "}
              <span className="ig-page-intro__title-muted">{titleMuted}</span>
            </>
          )}
        </Heading>
        {intro !== undefined && intro !== null && intro !== false && (
          <p className={["ig-page-intro__intro", editorial ? "paragraph-medium" : "paragraph-small"].join(" ")}>{intro}</p>
        )}
        {actions !== undefined && actions !== null && actions !== false && <div className="ig-page-intro__actions">{actions}</div>}
      </div>
      {children !== undefined && children !== null && children !== false && <div className="ig-page-intro__under">{children}</div>}
    </header>
  );
}
