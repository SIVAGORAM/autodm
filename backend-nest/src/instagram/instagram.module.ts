import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { TokenRefreshService } from './token-refresh.service';
import { InstagramController } from './instagram.controller';
import { InstagramAccountLifecycleService } from './instagram-account-lifecycle.service';

@Module({
  providers: [InstagramService, TokenRefreshService, InstagramAccountLifecycleService],
  controllers: [InstagramController],
  exports: [InstagramService, TokenRefreshService],
})
export class InstagramModule {}
