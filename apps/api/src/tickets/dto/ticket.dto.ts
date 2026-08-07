import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Priority, TicketStatus } from "@solidchat/shared";

export class CreateTicketDto {
  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(5)
  description!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsIn(Object.values(Priority))
  priority?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  assignedTeamId?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(Object.values(Priority)) priority?: string;
  @IsOptional() @IsIn(Object.values(TicketStatus)) status?: string;
  @IsOptional() @IsString() assignedTeamId?: string;
  @IsOptional() @IsString() assignedAgentId?: string;
}

export class CreateTicketCommentDto {
  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  isInternal?: boolean;
}

export class AssignTicketDto {
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() teamId?: string;
}

export class ResolveTicketDto {
  @IsString()
  @MinLength(3)
  resolution!: string;
}
