import type { ReactNode } from "react";
import { motion } from "motion/react";
import { sheetVariants } from "@/motion";
import { Icon } from "./Icon";
import { sheets } from "./sheetStore";

export function Sheet({ title, kicker, children, foot }: { title?: ReactNode; kicker?: ReactNode; children: ReactNode; foot?: ReactNode }) {
  return (
    <>
      <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={sheets.close} />
      <motion.section
        className="sheet"
        role="dialog"
        aria-modal="true"
        variants={sheetVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) sheets.close();
        }}
      >
        <div className="sheet-grab" />
        <div className="sheet-head">
          <div className="grow">
            {kicker && <div className="kicker" style={{ marginLeft: 0, marginBottom: 6 }}>{kicker}</div>}
            {title && <h2>{title}</h2>}
          </div>
          <button type="button" className="sheet-x" onClick={sheets.close} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {foot && <div className="sheet-foot">{foot}</div>}
      </motion.section>
    </>
  );
}
