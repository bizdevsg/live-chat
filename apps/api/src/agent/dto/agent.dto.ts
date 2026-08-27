import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AgentAvailability } from "@solidchat/shared";

export class SendAgentMessageDto {
  @IsString()
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;
}

export class InternalNoteDto {
  @IsString()
  @MinLength(1)
  content!: string;
}

export class TransferConversationDto {
  @IsOptional() @IsString() toAgentId?: string;
  @IsOptional() @IsString() toTeamId?: string;
}

export class UpdateAgentStatusDto {
  @IsIn(Object.values(AgentAvailability))
  availability!: string;
}

export class FindCrmCustomerByEmailDto {
  @IsEmail()
  email!: string;
}
