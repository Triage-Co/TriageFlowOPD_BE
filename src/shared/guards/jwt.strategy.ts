import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import envInstance from '../config/env.config';
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        rateLimit: true,
        cache: true,
        jwksUri: envInstance.SUPABASE_JWKS_URL,
        jwksRequestsPerMinute: 5,
      }),
      algorithms: ['ES256'],
    });
  }

  async validate(payload: any) {
    console.log(payload);
    return payload;
  }
}
