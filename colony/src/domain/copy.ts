// Every voice line in one place. First person plural, short, warm. No em dashes, ever.
import type { Need, Skill, TaskStatus, Urgency } from "@/domain/types";

export type NeedStatus = Need["status"];

export const COPY = {
  tagline: "Everyone has a role. Each one is vital.",

  promise:
    "Twenty-eight meals. A clean home. Happy plants. Seasonal preparedness, and maintenance that shows up before things break. Most of these things you will never have to ask for again.",

  noCut: "Colony takes nothing from your budget, and never touches tips or bonuses.",

  handled: "Noted. We will handle it.",

  curating: "Curating a few people who fit your colony",

  meal28: "28. You never had to ask.",

  roleLines: {
    cooking: "Warms the table twice a week",
    cleaning: "Leaves it better than they found it",
    laundry: "Returns everything folded",
    shopping: "Fills the fridge before it empties",
    house_manager: "The glue of the colony",
    plants: "Keeps the plants alive",
    handyman: "Shows up before things break",
    plumbing: "Knows every pipe by name",
    electrical: "Keeps the lights honest",
    hvac: "Keeps the air kind",
    pest: "Quietly keeps the uninvited out",
    sewing: "Mends what you love",
    seasonal: "Ahead of every season",
  } satisfies Record<Skill, string>,

  urgencyLabel: {
    whenever: "Whenever",
    this_week: "This week",
    soon: "Soon",
    urgent: "Urgent",
  } satisfies Record<Urgency, string>,

  urgencyHint: {
    whenever: "No rush. We will fold it into the next month.",
    this_week: "We will find someone within the week.",
    soon: "Within a few days.",
    urgent: "Today or tomorrow.",
  } satisfies Record<Urgency, string>,

  taskStatusLabel: {
    handled: "Handled",
    scheduled: "Scheduled",
    queued: "Queued",
    needs_you: "Needs you",
  } satisfies Record<TaskStatus, string>,

  needStatusLabel: {
    open: "Open",
    matching: "Finding people",
    matched: "Pick someone",
    scheduled: "Scheduled",
    done: "Done",
  } satisfies Record<NeedStatus, string>,

  toast: {
    handled: "Noted. We will handle it.",
    saved: "Saved.",
    visitDone: "Marked done. Thank you.",
    matchAccepted: "Booked. We will let them know.",
    matchDeclined: "No problem. We will keep looking.",
    monthClosed: "Month closed. The pool grew.",
    monthClosedTight: "Month closed. Nothing left to roll this time.",
    reset: "Back to the beginning.",
    invite: "Invite code copied.",
    broughtIn: "Welcome to the colony.",
    availability: "Availability updated.",
    membershipStarted: "Membership started. Thank you.",
    membershipCanceling: "We will end it at the period end.",
    membershipKept: "Glad you are staying.",
    installed: "Colony is on your home screen.",
    updateReady: "Update ready.",
  },

  manifesto: [
    "Everyone has a role and each one is vital.",
    "Let's attempt to be beautiful to one another, again.",
    "Colony doesn't take money from your system. We help you organize and get out of the way.",
    "Live with more relief that you have the right people around you.",
  ],

  empty: {
    needs: "Nothing needs you right now.",
    handled: "Nothing handled yet. Give it a week.",
    week: "A quiet week. Enjoy it.",
    pool: "The pool fills at the end of the month.",
  },
} as const;

export type Copy = typeof COPY;
