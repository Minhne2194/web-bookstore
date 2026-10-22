import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    CartModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'chuoi-bao-mat',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ||
          '15m') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, OptionalAuthGuard],
  exports: [AuthGuard, RolesGuard, OptionalAuthGuard, JwtModule],
})
export class AuthModule {}
