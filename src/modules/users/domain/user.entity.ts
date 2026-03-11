export class User {
  constructor(
    public readonly id: string,
    public readonly googleId: string,
    public readonly email: string,
    public name: string,
    public avatarUrl: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  updateProfile(name: string, avatarUrl?: string | null): void {
    this.name = name;
    if (avatarUrl !== undefined) this.avatarUrl = avatarUrl;
    this.updatedAt = new Date();
  }
}
