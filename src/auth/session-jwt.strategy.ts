import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { AuthService, PayloadType } from './auth.service';

@Injectable()
export class SessionJwtStrategy extends PassportStrategy(Strategy, 'session-jwt') {
  constructor(
    private configService: ConfigService,
    private sessionService: SessionService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: PayloadType) {
    // Extract session token from JWT payload if it exists
    const sessionToken = payload['sessionToken'];
    
    if (sessionToken) {
      // Validate the session token
      const session = await this.sessionService.validateSession(sessionToken);
      
      if (!session) {
        throw new UnauthorizedException('Invalid session');
      }

      const user = await this.authService.validateUserByEmail(payload.email);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return { ...user, session };
    }

    // Fallback to regular JWT validation
    const user = await this.authService.validateUserByEmail(payload.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    
    return user;
  }
}
