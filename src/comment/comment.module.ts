import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentResolver } from './comment.resolver';
import { CommentController } from './comment.controller';

@Module({
  providers: [CommentResolver, CommentService],
  controllers: [CommentController],
})
export class CommentModule {}
