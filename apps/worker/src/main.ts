import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
  Logger.log("SolidChat worker started — processing crm-sync, analytics-aggregation, cleanup queues.", "Bootstrap");
}

bootstrap();
