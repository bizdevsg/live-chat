import { IsEmail } from "class-validator";

export class ListCrmConversationsDto {
  @IsEmail()
  email!: string;
}

