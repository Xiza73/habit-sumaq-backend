import { DomainException } from '@common/exceptions/domain.exception';

const MAX_TITLE_LENGTH = 120;
const MAX_NOTES_LENGTH = 5000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Algo que hay que hacer una vez, opcionalmente en una fecha, opcionalmente a
 * una hora.
 *
 * Las tres formas son válidas y significan cosas distintas:
 *
 *  - sin fecha            → una nota suelta. No dispara alerta; es lo que hoy
 *                           se anota en Prioridades por no haber dónde más.
 *  - con fecha            → vence ese día, a cualquier hora.
 *  - con fecha y hora     → vence ese día, a partir de esa hora.
 *
 * Hora sin fecha NO es una forma válida: una hora sola no dice nada sobre
 * cuándo pasa algo que pasa una vez. El constructor la rechaza y
 * `applyUpdate` limpia la hora si se borra la fecha, para que ese estado no
 * se pueda alcanzar por la puerta de atrás.
 *
 * A diferencia de Chores, un recordatorio no es recurrente: completarlo no
 * corre ninguna fecha, lo cierra.
 */
export class Reminder {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public title: string,
    public notes: string | null,
    /** `YYYY-MM-DD` en la zona del usuario, o null. */
    public remindDate: string | null,
    /** `HH:mm` 24h, o null. Solo válida si hay `remindDate`. */
    public remindTime: string | null,
    public completed: boolean,
    public completedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    Reminder.assertTitle(title);
    Reminder.assertNotes(notes);
    Reminder.assertSchedule(remindDate, remindTime);
  }

  static assertTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new DomainException('REMINDER_TITLE_REQUIRED', 'El título es obligatorio');
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new DomainException(
        'REMINDER_TITLE_TOO_LONG',
        `El título no puede superar ${MAX_TITLE_LENGTH} caracteres`,
      );
    }
  }

  static assertNotes(notes: string | null): void {
    if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
      throw new DomainException(
        'REMINDER_NOTES_TOO_LONG',
        `Las notas no pueden superar ${MAX_NOTES_LENGTH} caracteres`,
      );
    }
  }

  static assertSchedule(remindDate: string | null, remindTime: string | null): void {
    if (remindDate !== null && !DATE_PATTERN.test(remindDate)) {
      throw new DomainException('REMINDER_DATE_INVALID', 'La fecha debe tener formato YYYY-MM-DD');
    }
    if (remindTime !== null) {
      if (remindDate === null) {
        throw new DomainException(
          'REMINDER_TIME_WITHOUT_DATE',
          'No se puede fijar una hora sin una fecha',
        );
      }
      if (!TIME_PATTERN.test(remindTime)) {
        throw new DomainException('REMINDER_TIME_INVALID', 'La hora debe tener formato HH:mm');
      }
    }
  }

  /**
   * Si el recordatorio ya toca, mirado desde `today` (`YYYY-MM-DD` en la zona
   * del usuario) a la hora local `currentHour`.
   *
   * Un recordatorio vencido sigue venciendo: no se acalla solo al pasar el
   * día. La hora, en cambio, **solo aplica el día para el que se fijó** — un
   * recordatorio de las 23:00 de la semana pasada se esconde cada mañana y
   * reaparece a las 23:00 si la hora siguiera aplicando, que es exactamente
   * cómo se pierde.
   */
  isDueOn(today: string, currentHour: number): boolean {
    if (this.completed) return false;
    if (this.remindDate === null) return false;
    if (this.remindDate > today) return false;
    if (this.remindDate < today) return true;

    if (this.remindTime === null) return true;
    return currentHour >= Number(this.remindTime.slice(0, 2));
  }

  applyUpdate(partial: {
    title?: string;
    notes?: string | null;
    remindDate?: string | null;
    remindTime?: string | null;
    completed?: boolean;
  }): void {
    if (partial.title !== undefined) {
      Reminder.assertTitle(partial.title);
      this.title = partial.title;
    }
    if (partial.notes !== undefined) {
      Reminder.assertNotes(partial.notes);
      this.notes = partial.notes;
    }

    // Date and time are resolved together: an update that clears the date must
    // also drop the time, or it would leave the time-without-date state the
    // constructor refuses to build.
    if (partial.remindDate !== undefined || partial.remindTime !== undefined) {
      // Only an EXPLICIT clear drops the time. Keying this off `nextDate ===
      // null` instead would also swallow "set a time on a reminder that has no
      // date" — silently ignoring the caller rather than telling them the
      // combination is not a thing.
      const clearingDate = partial.remindDate === null;
      const nextDate = partial.remindDate !== undefined ? partial.remindDate : this.remindDate;
      const nextTime = clearingDate
        ? null
        : partial.remindTime !== undefined
          ? partial.remindTime
          : this.remindTime;

      Reminder.assertSchedule(nextDate, nextTime);
      this.remindDate = nextDate;
      this.remindTime = nextTime;
    }

    if (partial.completed !== undefined && partial.completed !== this.completed) {
      this.completed = partial.completed;
      this.completedAt = partial.completed ? new Date() : null;
    }

    this.updatedAt = new Date();
  }
}
