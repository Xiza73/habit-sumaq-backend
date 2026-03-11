export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
}

// Payload del req.user en endpoints con JwtRefreshStrategy
export interface JwtRefreshPayload {
  userId: string;
  email: string;
  rawToken: string;
}
