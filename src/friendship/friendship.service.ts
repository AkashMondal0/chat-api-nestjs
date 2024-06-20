import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from 'src/db/drizzle/drizzle.provider';
import { CreateFriendshipInput } from './dto/create-friendship.input';
import { GraphQLError } from 'graphql';
import { DestroyFriendship } from './dto/delete-friendship.input';
import { and, eq, desc, count, countDistinct, exists } from 'drizzle-orm';
import { Friendship, User } from 'src/types';
import { CommentSchema, FriendshipSchema, LikeSchema, PostSchema, UserSchema } from 'src/db/drizzle/drizzle.schema';
import { PostResponse } from 'src/types/response.type';

@Injectable()
export class FriendshipService {
  constructor(private readonly drizzleProvider: DrizzleProvider) { }


  async create(createFollowInput: CreateFriendshipInput): Promise<Friendship|GraphQLError> {
    try {
      const check = await this.drizzleProvider.db.select().from(FriendshipSchema).where(and(
        eq(FriendshipSchema.followingUserId, createFollowInput.followingUserId),
        eq(FriendshipSchema.authorUserId, createFollowInput.authorUserId),
      ))
        .limit(1)

      if (check.length > 0) {
        throw new GraphQLError('Already following user', {
          extensions: {
            code: "ALREADY_FOLLOWING",
            http: { status: 401 },
          }
        })
      }
      const data = await this.drizzleProvider.db.insert(FriendshipSchema).values({
        followingUsername: createFollowInput.followingUsername,
        authorUsername: createFollowInput.authorUsername,
        authorUserId: createFollowInput.authorUserId,
        followingUserId: createFollowInput.followingUserId,
      }).returning()

      return data[0];

    } catch (error) {
      Logger.error(error)
      if (error instanceof GraphQLError) {
        throw error;
      } else {
        throw new GraphQLError('Internal Server Error', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    }
  }

  async deleteFriendship(destroyFriendship: DestroyFriendship): Promise<Friendship|GraphQLError> {
    try {
      const data = await this.drizzleProvider.db.delete(FriendshipSchema).where(and(
        eq(FriendshipSchema.followingUsername, destroyFriendship.followingUsername),
        eq(FriendshipSchema.authorUsername, destroyFriendship.authorUsername),
      )).returning()

      return data[0];
    } catch (error) {
      Logger.error(error)
      throw new GraphQLError('Error destroy friendship')
    }
  }

  async feedTimelineConnection(loggedUser: User): Promise<PostResponse[]> {
    try {
      if (!loggedUser.id) {
        throw new GraphQLError('User not found', {
          extensions: {
            code: "UNAUTHORIZED_USER",
            http: { status: 401 },
          }
        })
      }
      const data = await this.drizzleProvider.db.select({
        id: PostSchema.id,
        content: PostSchema.content,
        fileUrl: PostSchema.fileUrl,
        commentCount: count(eq(CommentSchema.postId, PostSchema.id)),
        likeCount: countDistinct(eq(LikeSchema.postId, PostSchema.id)),
        createdAt: PostSchema.createdAt,
        updatedAt: PostSchema.updatedAt,
        is_Liked: exists(this.drizzleProvider.db.select().from(LikeSchema).where(and(
          eq(LikeSchema.authorId, loggedUser.id), // <- replace with user id
          eq(LikeSchema.postId, PostSchema.id)
        ))),
        user: {
          id: UserSchema.id,
          username: UserSchema.username,
          email: UserSchema.email,
          profilePicture: UserSchema.profilePicture,
          name: UserSchema.name,
          followed_by: exists(this.drizzleProvider.db.select().from(FriendshipSchema).where(and(
            eq(FriendshipSchema.followingUserId, loggedUser.id),
            eq(FriendshipSchema.authorUserId, UserSchema.id) // <- replace with user id
          ))),
        },
      })
        .from(FriendshipSchema)
        .where(eq(FriendshipSchema.authorUserId, loggedUser.id)) // <- replace with logged in user id
        .limit(12)
        .offset(0)
        .orderBy(desc(PostSchema.createdAt))
        .leftJoin(PostSchema, eq(FriendshipSchema.followingUserId, PostSchema.authorId))
        .leftJoin(CommentSchema, eq(PostSchema.id, CommentSchema.postId))
        .leftJoin(LikeSchema, eq(PostSchema.id, LikeSchema.postId))
        .leftJoin(UserSchema, eq(PostSchema.authorId, UserSchema.id))
        .groupBy(PostSchema.id, UserSchema.id)

      return data;
    } catch (error) {
      Logger.error(error)
      // console.log(error)
      throw new GraphQLError('Error feed Timeline Connection friendship')
    }
  }

}