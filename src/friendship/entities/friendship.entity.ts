import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Friendship {

  @Field(() => Boolean)
  friendShip: boolean;
}
