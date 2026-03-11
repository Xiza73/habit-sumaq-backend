export class RefreshToken {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly token: string, // SHA-256 hash — nunca el token en claro
    public readonly expiresAt: Date,
    public readonly revokedAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  isValid(): boolean {
    return this.revokedAt === null && this.expiresAt > new Date();
  }
}
