/**
 * Lifecycle of a task inside a section.
 *
 * Replaces a `completed: boolean` that needed a third value. The states are
 * ordered and linear — you validate something before you call it done — so a
 * flag alongside the boolean would have permitted `completed && inReview`,
 * a combination with no meaning that every consumer would have had to guard
 * by hand.
 *
 * `IN_REVIEW` is deliberately NOT a flavour of done: the weekly cleanup
 * hard-deletes finished tasks, and a task you are still checking must survive
 * that sweep.
 */
export enum TaskStatus {
  /** Not started, or in progress. The default. */
  PENDING = 'PENDING',
  /** Finished but being verified. Never swept by the weekly cleanup. */
  IN_REVIEW = 'IN_REVIEW',
  /** Done. Eligible for the weekly cleanup once the week rolls over. */
  DONE = 'DONE',
}
