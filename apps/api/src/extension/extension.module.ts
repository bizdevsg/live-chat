import { Module } from "@nestjs/common";
import { ExtensionTokenModule } from "../auth/extension-token/extension-token.module";
import { ExtensionController } from "./extension.controller";
import { ExtensionService } from "./extension.service";

@Module({
  imports: [ExtensionTokenModule],
  controllers: [ExtensionController],
  providers: [ExtensionService],
})
export class ExtensionModule {}
