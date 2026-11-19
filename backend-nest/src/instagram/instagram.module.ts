import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { TokenRefreshService } from './token-refresh.service';
import { InstagramController } from './instagram.controller';

@Module({
  providers: [InstagramService, TokenRefreshService],
  controllers: [InstagramController],
  exports: [InstagramService, TokenRefreshService],
})
export class InstagramModule {}
