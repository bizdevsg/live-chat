import { Global, Module } from "@nestjs/common";
import { ExtensionTokenController } from "./extension-token.controller";
import { ExtensionTokenGuard } from "./extension-token.guard";
import { ExtensionTokenService } from "./extension-token.service";

@Global()
@Module({
  controllers: [ExtensionTokenController],
  providers: [ExtensionTokenService, ExtensionTokenGuard],
  exports: [ExtensionTokenService, ExtensionTokenGuard],
})
export class ExtensionTokenModule {}
