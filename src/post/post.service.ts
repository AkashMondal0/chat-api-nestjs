
import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from 'src/db/drizzle/drizzle.provider';
import { count, eq, desc, exists, and, countDistinct, sql } from "drizzle-orm";
import { GraphQLError } from 'graphql';
import { CommentSchema, FriendshipSchema, LikeSchema, PostSchema, UserSchema } from 'src/db/drizzle/drizzle.schema';
import { CreatePostInput } from './dto/create-post.input';
import { GraphQLPageQuery } from 'src/lib/types/graphql.global.entity';
import { Author } from 'src/users/entities/author.entity';
import { Post } from './entities/post.entity';

@Injectable()
export class PostService {
  constructor(private readonly drizzleProvider: DrizzleProvider) { }

  async findProfilePosts(loggedUser: Author, findPosts: GraphQLPageQuery): Promise<Post[] | GraphQLError> {
    try {
      const data = await this.drizzleProvider.db.select({
        id: PostSchema.id,
        content: PostSchema.content,
        fileUrl: PostSchema.fileUrl,
        likeCount: sql`COUNT(DISTINCT ${LikeSchema.id}) AS likeCount`,
        commentCount: sql`COUNT(DISTINCT ${CommentSchema.id}) AS commentCount`,
        createdAt: PostSchema.createdAt,
        updatedAt: PostSchema.updatedAt,
      })
        .from(PostSchema)
        .leftJoin(LikeSchema, eq(PostSchema.id, LikeSchema.postId))
        .leftJoin(CommentSchema, eq(PostSchema.id, CommentSchema.postId))
        .where(eq(PostSchema.username, findPosts.id))
        .orderBy(desc(PostSchema.createdAt))
        .limit(Number(findPosts.limit) ?? 12)
        .offset(Number(findPosts.offset) ?? 0)
        .groupBy(PostSchema.id, CommentSchema.postId)

      return data as Post[]
    } catch (error) {
      Logger.error(error)
      throw new GraphQLError(error)
    }
  }

  async findOnePostWithComment(loggedUser: Author, id: string): Promise<Post | GraphQLError> {
    try {
      if (loggedUser) {
        const _data = await this.drizzleProvider.db.select({
          id: PostSchema.id,
          content: PostSchema.content,
          fileUrl: PostSchema.fileUrl,
          likeCount: sql`COUNT(DISTINCT ${LikeSchema.id}) AS likeCount`,
          commentCount: sql`COUNT(DISTINCT ${CommentSchema.id}) AS commentCount`,
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
          },
        }).from(PostSchema)
          .where(eq(PostSchema.id, id))
          .limit(1)
          .leftJoin(LikeSchema, eq(PostSchema.id, LikeSchema.postId))
          .leftJoin(CommentSchema, eq(PostSchema.id, CommentSchema.postId))
          .leftJoin(UserSchema, eq(PostSchema.authorId, UserSchema.id))
          .groupBy(PostSchema.id, UserSchema.id, CommentSchema.postId)

        return {
          ..._data[0],
          comments: []
        } as Post
      } else {
        const _data = await this.drizzleProvider.db.select({
          id: PostSchema.id,
          content: PostSchema.content,
          fileUrl: PostSchema.fileUrl,
          likeCount: sql`COUNT(DISTINCT ${LikeSchema.id}) AS likeCount`,
          commentCount: sql`COUNT(DISTINCT ${CommentSchema.id}) AS commentCount`,
          createdAt: PostSchema.createdAt,
          updatedAt: PostSchema.updatedAt,
          user: {
            id: UserSchema.id,
            username: UserSchema.username,
            email: UserSchema.email,
            profilePicture: UserSchema.profilePicture,
            name: UserSchema.name,
          },
        }).from(PostSchema)
          .where(eq(PostSchema.id, id))
          .limit(1)
          .leftJoin(LikeSchema, eq(PostSchema.id, LikeSchema.postId))
          .leftJoin(CommentSchema, eq(PostSchema.id, CommentSchema.postId))
          .leftJoin(UserSchema, eq(PostSchema.authorId, UserSchema.id))
          .groupBy(PostSchema.id, UserSchema.id, CommentSchema.postId)

        return {
          ..._data[0],
          comments: []
        } as Post
      }

      // const comments = await this.drizzleProvider.db.select({
      //   id: CommentSchema.id,
      //   postId: CommentSchema.postId,
      //   content: CommentSchema.content,
      //   authorId: CommentSchema.authorId,
      //   createdAt: CommentSchema.createdAt,
      //   user: {
      //     id: UserSchema.id,
      //     username: UserSchema.username,
      //     email: UserSchema.email,
      //     profilePicture: UserSchema.profilePicture,
      //     name: UserSchema.name,
      //   }
      // })
      //   .from(CommentSchema)
      //   .where(eq(CommentSchema.postId, id))
      //   .leftJoin(UserSchema, eq(CommentSchema.authorId, UserSchema.id))
      //   .orderBy(desc(CommentSchema.createdAt))
      //   .limit(10)
      //   .offset(0)
    } catch (error) {
      Logger.error(error)
      throw new GraphQLError(error)
    }
  }

  //findPublicPostData
  async findPublicPostData(id: string): Promise<Post | null> {
    try {
      const data = await this.drizzleProvider.db.select({
        id: PostSchema.id,
        content: PostSchema.content,
        fileUrl: PostSchema.fileUrl,
        likeCount: count(LikeSchema.id),
        commentCount: count(CommentSchema.id),
        createdAt: PostSchema.createdAt,
        updatedAt: PostSchema.updatedAt,
        user: {
          username: UserSchema.username,
          profilePicture: UserSchema.profilePicture,
          name: UserSchema.name,
        },
      }).from(PostSchema)
        .where(eq(PostSchema.id, id))
        .limit(1)
        .leftJoin(LikeSchema, eq(LikeSchema.postId, PostSchema.id))
        .leftJoin(CommentSchema, eq(CommentSchema.postId, PostSchema.id))
        .leftJoin(UserSchema, eq(PostSchema.authorId, UserSchema.id))
        .groupBy(
          PostSchema.id,
          UserSchema.id,
          CommentSchema.postId)

      return data[0]
    } catch (error) {
      Logger.error(error)
      throw new GraphQLError(error)
    }
  }

  async createPost(loggedUser: Author, body: CreatePostInput): Promise<Post | GraphQLError> {
    try {
      if (loggedUser.id !== body.authorId) {
        throw new GraphQLError('You are not authorized to perform this action')
      }
      const data = await this.drizzleProvider.db.insert(PostSchema).values({
        content: body.content ?? "",
        fileUrl: body.fileUrl,
        authorId: loggedUser.id,
        status: body.status,
        username: loggedUser.username,
        title: body.title ?? "",
      }).returning()

      return data[0]
    } catch (error) {
      Logger.error(error)
      throw new GraphQLError(error)
    }
  }

}
