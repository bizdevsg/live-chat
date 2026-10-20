import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import {
  ExtensionTokenGuard,
  type ExtensionRequest,
} from "../auth/extension-token/extension-token.guard";
import {
  EXTENSION_CHANNELS,
  ExtensionSnapshotDto,
  type ExtensionChannel,
} from "./dto/extension-snapshot.dto";
import { ExtensionService } from "./extension.service";
import { BadRequestException } from "@nestjs/common";

@Public()
@UseGuards(ExtensionTokenGuard)
@Controller("api/v1/extension")
export class ExtensionController {
  constructor(private readonly extension: ExtensionService) {}

  @Post(":channel/snapshots")
  async snapshot(
    @Param("channel") channel: string,
    @Body() dto: ExtensionSnapshotDto,
    @Req() request: ExtensionRequest,
  ) {
    if (!EXTENSION_CHANNELS.includes(channel as ExtensionChannel))
      throw new BadRequestException("Channel extension tidak didukung.");
    return {
      success: true,
      data: await this.extension.upsertSnapshot(
        channel as ExtensionChannel,
        dto,
        request.extensionUser,
      ),
    };
  }
}
