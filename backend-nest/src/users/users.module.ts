import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDeletionController } from './account-deletion.controller';
import { ProfilesController } from '../profiles/profiles.controller';
import { PublicProfilesController } from '../profiles/public-profiles.controller';
import { ProfilesService } from '../profiles/profiles.service';
import { ProfileStorageService } from '../profiles/profile-storage.service';

@Module({
  controllers: [UsersController, AccountDeletionController, ProfilesController, PublicProfilesController],
  providers: [UsersService, ProfilesService, ProfileStorageService],
})
export class UsersModule {}
