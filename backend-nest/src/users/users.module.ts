import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDeletionController } from './account-deletion.controller';
import { ProfilesController } from '../profiles/profiles.controller';
import { PublicProfilesController } from '../profiles/public-profiles.controller';
import { ProfilesService } from '../profiles/profiles.service';
import { ProfileStorageService } from '../profiles/profile-storage.service';
import { PublicProfileFaviconController } from '../profiles/public-profile-favicon.controller';
import { PublicProfileFaviconService } from '../profiles/public-profile-favicon.service';

@Module({
  controllers: [UsersController, AccountDeletionController, ProfilesController, PublicProfilesController, PublicProfileFaviconController],
  providers: [UsersService, ProfilesService, ProfileStorageService, PublicProfileFaviconService],
})
export class UsersModule {}
