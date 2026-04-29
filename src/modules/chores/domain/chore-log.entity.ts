/**
 * A single completion event of a `Chore`. Immutable after insert (the user
 * can delete a chore log later if needed, but there's no "edit" flow in v1).
 *
 * `doneAt` is stored as `YYYY-MM-DD` because the user only cares about the
 * day, not the time. `note` is optional free text up to 500 chars.
 */
export class ChoreLog {
  constructor(
    readonly id: string,
    readonly choreId: string,
    readonly doneAt: string,
    readonly note: string | null,
    readonly createdAt: Date,
  ) {}
}
