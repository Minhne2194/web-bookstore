import { Module } from '@nestjs/common';
import { BehaviorController } from './behavior.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BehaviorController],
})
export class BehaviorModule {}
