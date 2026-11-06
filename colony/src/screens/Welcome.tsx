import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Mark } from "@/brand/Mark";
import { Btn } from "@/ui/Btn";
import { COPY } from "@/domain/copy";
import { tourDemo } from "@/store/actions";
import { useColonyState } from "@/store/store";

export function Welcome() {
  const nav = useNavigate();
  const state = useColonyState();
  return (
    <motion.main className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div>
        <Mark size={72} drawIn className="mark" />
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          Colony
        </motion.h1>
        <motion.p className="voice" style={{ marginTop: 18, maxWidth: 320 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.6 }}>
          {COPY.tagline}
        </motion.p>
        <motion.p className="sub" style={{ marginTop: 28, maxWidth: 360 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25, duration: 0.6 }}>
          A few households, one budget, and the right people around you. Dinners, a clean home, happy plants, and maintenance that shows up before things break.
        </motion.p>
      </div>
      <motion.div className="stack" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.5 }}>
        <Btn
          variant="honey"
          block
          onClick={() => {
            tourDemo();
            nav("/", { replace: true });
          }}
        >
          Tour {state.colony.name}
        </Btn>
        <Btn variant="ghost" block onClick={() => nav("/start/1")}>
          Start your own colony
        </Btn>
        <p className="tiny muted" style={{ textAlign: "center", marginTop: 6 }}>
          {COPY.noCut}
        </p>
      </motion.div>
    </motion.main>
  );
}
