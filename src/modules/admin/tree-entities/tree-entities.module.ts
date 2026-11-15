import { Module } from '@nestjs/common';
import { TreeEntitiesService } from './tree-entities.service';
import { TreeEntitiesController } from './tree-entities.controller';

@Module({
  controllers: [TreeEntitiesController],
  providers: [TreeEntitiesService],
  exports: [TreeEntitiesService],
})
export class TreeEntitiesModule {}
