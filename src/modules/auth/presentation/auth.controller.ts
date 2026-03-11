import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { ApiResponse as ApiResponseDto } from '@common/dto/api-response.dto';

import { UserResponseDto } from '../../users/application/dto/user-response.dto';
import { GetUserProfileUseCase } from '../../users/application/use-cases/get-user-profile.use-case';
import { AuthTokensDto } from '../application/dto/auth-response.dto';
import { GoogleLoginUseCase } from '../application/use-cases/google-login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RotateRefreshTokenUseCase } from '../application/use-cases/rotate-refresh-token.use-case';

import type { User } from '../../users/domain/user.entity';
import type { JwtPayload, JwtRefreshPayload } from '../application/dto/jwt-payload.dto';
import type { Request, Response } from 'express';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleLoginUseCase: GoogleLoginUseCase,
    private readonly rotateRefreshToken: RotateRefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getUserProfile: GetUserProfileUseCase,
  ) {}

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Iniciar flujo de autenticación con Google' })
  @ApiResponse({ status: 302, description: 'Redirige a Google OAuth' })
  googleAuth(): void {
    // Passport redirige a Google
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth — redirige al frontend con access token' })
  @ApiResponse({ status: 302, description: 'Redirige al frontend con token' })
  async googleCallback(@CurrentUser() user: User, @Res() res: Response): Promise<void> {
    const { accessToken, rawRefreshToken } = await this.googleLoginUseCase.execute(user);
    this.setRefreshCookie(res, rawRefreshToken);

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  }

  @Post('refresh')
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotar access token usando el refresh token de la cookie' })
  @ApiResponse({ status: 200, description: 'Nuevo access token', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(
    @CurrentUser() { userId, email, rawToken }: JwtRefreshPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponseDto<AuthTokensDto>> {
    const { accessToken, rawRefreshToken } = await this.rotateRefreshToken.execute(
      userId,
      email,
      rawToken,
    );
    this.setRefreshCookie(res, rawRefreshToken);
    return ApiResponseDto.ok({ accessToken }, 'Token renovado exitosamente');
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar sesión y revocar refresh token' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawToken = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    await this.logoutUseCase.execute(rawToken);
    res.clearCookie(REFRESH_COOKIE);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async me(@CurrentUser() payload: JwtPayload): Promise<ApiResponseDto<UserResponseDto>> {
    const user = await this.getUserProfile.execute(payload.sub);
    return ApiResponseDto.ok(UserResponseDto.fromDomain(user), 'Perfil obtenido exitosamente');
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
  }
}
