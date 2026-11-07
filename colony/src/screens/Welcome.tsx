import { useNavigate } from "react-router";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import { Screen, Mark, Card, Kicker, Button, dist, dur, ease, overlay, useReducedMotion } from "@/system";
import { COPY } from "@/domain/copy";
import { tourDemo } from "@/store/actions";
import { useColonyState } from "@/store/store";
import "./Welcome.css";

/* The mark draws first (0 to 440ms); the word lifts in at 300ms over the information pace, the tagline 55ms later, the body 110ms later,
   the card with the overlay rule 165ms later. */
const WORD_AT = 0.3;
const lift = (delay: number): Variants => ({
  hidden: { opacity: 0, y: dist.lg },
  show: { opacity: 1, y: 0, transition: { opacity: { duration: dur.information, ease: ease.neutral, delay }, y: { duration: dur.information, ease: ease.enter, delay } } },
});
const delayed = (v: Variants, delay: number): Variants => ({ ...v, show: { ...(v.show as object), transition: { duration: dur.normal, ease: ease.enter, delay } } });
const still: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0 } } };

/** Welcome: a dark surface, the ring, the word, one Cardo line, and the one white card holding the two ways in. */
export function Welcome() {
  const nav = useNavigate();
  const state = useColonyState();
  const reduced = useReducedMotion();
  const v = (variants: Variants) => (reduced ? still : variants);

  return (
    <Screen bare mode="dark" className="welcome" restoreScroll={false}>
      <div className="welcome__top">
        <Mark size="lg" drawIn className="welcome__mark" />
        <motion.h1 className="welcome__title headline-large" variants={v(lift(WORD_AT))} initial="hidden" animate="show">
          Colony
        </motion.h1>
        <motion.p className="welcome__tagline paragraph-medium" variants={v(lift(WORD_AT + 0.055))} initial="hidden" animate="show">
          {COPY.tagline}
        </motion.p>
        <motion.p className="welcome__body paragraph-x-small secondary" variants={v(lift(WORD_AT + 0.11))} initial="hidden" animate="show">
          A few households, one budget, and the right people around you. Dinners, a clean home, happy plants, and maintenance that shows up before things break.
        </motion.p>
      </div>

      <motion.div variants={v(delayed(overlay(dist.md), WORD_AT + 0.165))} initial="hidden" animate="show">
        <Card ground="edge" data-mode="light" className="welcome__card">
          <Kicker tone="secondary" className="welcome__kicker">
            WELCOME
          </Kicker>
          <Button
            block
            className="welcome__tour"
            onClick={() => {
              tourDemo();
              nav("/", { replace: true });
            }}
          >
            Tour {state.colony.name}
          </Button>
          <Button variant="outlined" hideIcon block onClick={() => nav("/start/1")}>
            Start your own colony
          </Button>
          <p className="welcome__note paragraph-x-small secondary">{COPY.noCut}</p>
        </Card>
      </motion.div>
    </Screen>
  );
}
