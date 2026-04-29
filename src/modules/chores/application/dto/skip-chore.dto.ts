/**
 * Empty body for the `POST /chores/:id/skip` endpoint. Kept as a class so we
 * can attach Swagger/validator decorators in the future without changing the
 * controller signature. Skipping advances `nextDueDate` by one interval and
 * does NOT take arguments in v1.
 */
export class SkipChoreDto {}
