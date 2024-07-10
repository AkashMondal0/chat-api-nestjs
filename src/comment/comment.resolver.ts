import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { CommentService } from './comment.service';
import { Comment } from './entities/comment.entity';
import { CreateCommentInput } from './dto/create-comment.input';
import { UpdateCommentInput } from './dto/update-comment.input';
import { SessionUserGraphQl } from 'src/decorator/session.decorator';
import { User } from 'src/types';
import { GqlAuthGuard } from 'src/auth/guard/Gql-auth.guard';
import { UseGuards } from '@nestjs/common';
import { FindCommentInput } from './dto/find-comment.input';
import { GraphQLOperation } from 'src/types/graphql.global.entity';

@Resolver(() => Comment)
export class CommentResolver {
  constructor(private readonly commentService: CommentService) { }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Comment, { name: 'createComment' })
  createComment(@SessionUserGraphQl() user: User, @Args('createCommentInput') createCommentInput: CreateCommentInput) {
    return this.commentService.create(user, createCommentInput);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [Comment], { name: 'findComments' })
  findAll(@SessionUserGraphQl() user: User, @Args('createCommentInput') findCommentInput: FindCommentInput) {
    return this.commentService.findAll(user, findCommentInput);
  }
  
  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphQLOperation, { name: 'updateComment' })
  updateComment(@SessionUserGraphQl() user: User,@Args('updateCommentInput') updateCommentInput: UpdateCommentInput) {
    return this.commentService.update(user, updateCommentInput);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => GraphQLOperation, { name: 'destroyComment' })
  removeComment(@SessionUserGraphQl() user: User,@Args('id', { type: () => String }) id: string) {
    return this.commentService.remove(user, id);
  }
}
