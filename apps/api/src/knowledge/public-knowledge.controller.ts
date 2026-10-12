import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { PublicKnowledgeQueryDto } from "./dto/knowledge.dto";
import { KnowledgeService } from "./knowledge.service";
import { PublicKnowledgeApiKeyGuard } from "./public-knowledge-api-key.guard";

@ApiTags("public-knowledge")
@Public()
@UseGuards(PublicKnowledgeApiKeyGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
@Controller("api/v1/public/knowledge")
export class PublicKnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly config: ConfigService,
  ) {}

  @Get("documents")
  async list(@Query() query: PublicKnowledgeQueryDto) {
    const data = await this.knowledgeService.listPublic(
      query,
      this.config.get<string>("PUBLIC_KNOWLEDGE_SITE_ID") ||
        this.config.get<string>("WHATSAPP_ASSISTANT_SITE_ID"),
    );
    return { success: true, data };
  }

  @Get("documents/:slug")
  async get(@Param("slug") slug: string, @Query("siteId") siteId?: string) {
    const data = await this.knowledgeService.getPublicBySlug(
      slug,
      siteId,
      this.config.get<string>("PUBLIC_KNOWLEDGE_SITE_ID") ||
        this.config.get<string>("WHATSAPP_ASSISTANT_SITE_ID"),
    );
    return { success: true, data };
  }
}
