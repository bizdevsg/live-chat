import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { AgentAvailability } from "@solidchat/shared";

export class SendAgentMessageDto {
  @IsString()
  // The inbox caps agent replies at 512 characters; the extra room keeps a normal send from failing
  // while still stopping oversized requests made directly against the API.
  @MaxLength(600)
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
