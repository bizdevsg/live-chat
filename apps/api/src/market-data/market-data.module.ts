import { Global, Module } from "@nestjs/common";
import { MarketDataService } from "./market-data.service";

@Global()
@Module({
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
