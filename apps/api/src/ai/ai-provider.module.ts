import { Global, Module } from "@nestjs/common";
import { AiProviderFactory } from "./ai-provider.factory";

@Global()
@Module({
  providers: [AiProviderFactory],
  exports: [AiProviderFactory],
})
export class AiProviderModule {}
