import { DomainException } from '@common/exceptions/domain.exception';

const MAX_NAME_LENGTH = 60;

/**
 * Container for tasks. A user can have many sections; each section holds many
 * tasks. Sections are user-orderable (drag-and-drop), but renames don't
 * cascade or reset task positions — tasks live independently inside the
 * section.
 *
 * Color is optional — a hex like `#FF6B35`. Used by the web client to render
 * a small swatch next to the section header. Backend just validates the
 * shape; the frontend owns the palette decisions.
 */
export class Section {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public name: string,
    public color: string | null,
    public position: number,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    Section.assertName(name);
    // Color shape is enforced by class-validator at the DTO layer (`@Matches`).
    // The entity trusts the value once it reaches the domain.
  }

  static assertName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainException('SECTION_NAME_REQUIRED', 'El nombre de la sección es obligatorio');
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new DomainException(
        'SECTION_NAME_TOO_LONG',
        `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres`,
      );
    }
  }

  applyUpdate(partial: { name?: string; color?: string | null; position?: number }): void {
    if (partial.name !== undefined) {
      Section.assertName(partial.name);
      this.name = partial.name;
    }
    if (partial.color !== undefined) {
      this.color = partial.color;
    }
    if (partial.position !== undefined) {
      this.position = partial.position;
    }
    this.updatedAt = new Date();
  }
}
