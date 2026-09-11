/**
 * Explicit assignment state machine. Every transition is validated server-side
 * and recorded in the append-only assignment_status_history table.
 */
export const ASSIGNMENT_STATUSES = [
  "DRAFT",
  "OPEN",
  "PROFESSIONAL_INVITED",
  "OFFER_RECEIVED",
  "ACCEPTED",
  "IN_PROGRESS",
  "DELIVERED",
  "REVISION_REQUESTED",
  "FINAL_REVIEW",
  "SIGNED",
  "CUSTOMER_APPROVED",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export type TransitionActor = "CUSTOMER" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";

interface Transition {
  to: AssignmentStatus;
  actors: TransitionActor[];
}

const TRANSITIONS: Record<AssignmentStatus, Transition[]> = {
  DRAFT: [
    { to: "OPEN", actors: ["CUSTOMER"] },
    { to: "PROFESSIONAL_INVITED", actors: ["CUSTOMER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  OPEN: [
    { to: "PROFESSIONAL_INVITED", actors: ["CUSTOMER"] },
    { to: "OFFER_RECEIVED", actors: ["PROFESSIONAL", "SYSTEM"] },
    { to: "ACCEPTED", actors: ["CUSTOMER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  PROFESSIONAL_INVITED: [
    { to: "OFFER_RECEIVED", actors: ["PROFESSIONAL", "SYSTEM"] },
    { to: "OPEN", actors: ["CUSTOMER", "SYSTEM"] },
    { to: "ACCEPTED", actors: ["CUSTOMER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  OFFER_RECEIVED: [
    { to: "ACCEPTED", actors: ["CUSTOMER"] },
    { to: "OPEN", actors: ["CUSTOMER", "SYSTEM"] },
    { to: "PROFESSIONAL_INVITED", actors: ["CUSTOMER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "ADMIN"] },
  ],
  ACCEPTED: [
    { to: "IN_PROGRESS", actors: ["PROFESSIONAL", "SYSTEM"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "PROFESSIONAL", "ADMIN"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  IN_PROGRESS: [
    { to: "DELIVERED", actors: ["PROFESSIONAL"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
    { to: "CANCELLED", actors: ["ADMIN"] },
  ],
  DELIVERED: [
    { to: "REVISION_REQUESTED", actors: ["CUSTOMER"] },
    { to: "FINAL_REVIEW", actors: ["CUSTOMER", "PROFESSIONAL", "SYSTEM"] },
    { to: "SIGNED", actors: ["PROFESSIONAL"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  REVISION_REQUESTED: [
    { to: "IN_PROGRESS", actors: ["PROFESSIONAL", "SYSTEM"] },
    { to: "DELIVERED", actors: ["PROFESSIONAL"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  FINAL_REVIEW: [
    { to: "SIGNED", actors: ["PROFESSIONAL"] },
    { to: "REVISION_REQUESTED", actors: ["CUSTOMER"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  SIGNED: [
    { to: "CUSTOMER_APPROVED", actors: ["CUSTOMER"] },
    { to: "REVISION_REQUESTED", actors: ["CUSTOMER"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  CUSTOMER_APPROVED: [
    { to: "COMPLETED", actors: ["SYSTEM", "CUSTOMER", "ADMIN"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL"] },
  ],
  COMPLETED: [{ to: "DISPUTED", actors: ["CUSTOMER", "PROFESSIONAL", "ADMIN"] }],
  DISPUTED: [
    { to: "COMPLETED", actors: ["ADMIN"] },
    { to: "CANCELLED", actors: ["ADMIN"] },
    { to: "IN_PROGRESS", actors: ["ADMIN"] },
    { to: "SIGNED", actors: ["ADMIN"] },
  ],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {
  status = 409;
  constructor(from: AssignmentStatus, to: AssignmentStatus, actor: TransitionActor) {
    super(`Transition ${from} → ${to} is not permitted for ${actor}`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(from: AssignmentStatus, to: AssignmentStatus, actor: TransitionActor): boolean {
  const options = TRANSITIONS[from] ?? [];
  return options.some((t) => t.to === to && t.actors.includes(actor));
}

export function assertTransition(from: AssignmentStatus, to: AssignmentStatus, actor: TransitionActor): void {
  if (!canTransition(from, to, actor)) throw new InvalidTransitionError(from, to, actor);
}

export function availableTransitions(from: AssignmentStatus, actor: TransitionActor): AssignmentStatus[] {
  return (TRANSITIONS[from] ?? []).filter((t) => t.actors.includes(actor)).map((t) => t.to);
}

export const TERMINAL_STATUSES: AssignmentStatus[] = ["COMPLETED", "CANCELLED"];

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open for offers",
  PROFESSIONAL_INVITED: "Professional invited",
  OFFER_RECEIVED: "Offer received",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  DELIVERED: "Delivered",
  REVISION_REQUESTED: "Revision requested",
  FINAL_REVIEW: "Final review",
  SIGNED: "Signed",
  CUSTOMER_APPROVED: "Approved by customer",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
};

export const STATUS_DESCRIPTIONS: Record<AssignmentStatus, string> = {
  DRAFT: "The brief is being prepared and is not yet visible to professionals.",
  OPEN: "Professionals can send offers.",
  PROFESSIONAL_INVITED: "A professional has been invited and can respond with an offer.",
  OFFER_RECEIVED: "One or more offers are waiting for the customer.",
  ACCEPTED: "An offer was accepted. Work can begin once payment is secured.",
  IN_PROGRESS: "The professional is working on the assignment.",
  DELIVERED: "A version has been delivered and awaits review.",
  REVISION_REQUESTED: "The customer asked for changes.",
  FINAL_REVIEW: "The final version is under review before sign-off.",
  SIGNED: "The professional has signed the final version.",
  CUSTOMER_APPROVED: "The customer approved the signed version.",
  COMPLETED: "The assignment is complete.",
  DISPUTED: "A dispute is being handled by the platform.",
  CANCELLED: "The assignment was cancelled.",
};
