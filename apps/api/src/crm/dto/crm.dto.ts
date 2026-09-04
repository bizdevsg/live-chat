import { IsEmail, IsOptional, IsString } from "class-validator";

/** Query contract for `GET /api/v1/conversations` — lookup by the handling agent's email. */
export class ListCrmConversationsQueryDto {
  /** Live Chat agent email. Conversations assigned to or handled by this agent are returned. */
  @IsEmail()
  email!: string;

  /** `Site.siteKey` — required only when the presented credential can read more than one site. */
  @IsOptional()
  @IsString()
  site_id?: string;
}
