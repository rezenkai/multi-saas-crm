import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import auth0Config from '../config/auth0.config';
import { UserModule } from '../user/user.module';
import { Auth0Controller } from './auth0.controller';
import { Auth0Service } from './auth0.service';

@Module({
  imports: [
    ConfigModule.forFeature(auth0Config),
    UserModule, // For UserService
    AuthModule, // For JwtService and guards
  ],
  controllers: [Auth0Controller],
  providers: [Auth0Service],
  exports: [Auth0Service], // Export for other modules
})
export class Auth0Module {}
