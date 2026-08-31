import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { PrismaService } from "./prisma/prisma.service";

function parseOrigin(value: string): { origin: string; host: string; hostname: string } | null {
  try {
    const parsed = new URL(value);
    return {
      origin: parsed.origin,
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function wildcardMatches(hostname: string, pattern: string) {
  if (!pattern.startsWith("*.")) return false;
  const suffix = pattern.slice(2);
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);
  const isProduction = config.get<string>("NODE_ENV") === "production";

  app.use(helmet());
  app.use(cookieParser());

  const developmentOrigins = isProduction
    ? []
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5176",
      ];
  const configuredOrigins = [
    ...developmentOrigins,
    config.get<string>("APP_URL"),
    config.get<string>("WIDGET_URL"),
    ...(config.get<string>("CORS_ALLOWED_ORIGINS") ?? "").split(","),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
  const allowedOrigins = new Set(
    configuredOrigins
      .map((origin) => parseOrigin(origin)?.origin ?? origin)
      .filter(Boolean),
  );

  app.enableCors({
    origin: async (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);

      const parsedOrigin = parseOrigin(origin);
      if (!parsedOrigin) {
        callback(new Error("Origin tidak diizinkan oleh kebijakan CORS."), false);
        return;
      }

      try {
        const matchingDomain = await prisma.siteDomain.findFirst({
          where: {
            domain: {
              in: [parsedOrigin.host, parsedOrigin.hostname],
            },
          },
          select: { id: true },
        });
        if (matchingDomain) {
          callback(null, true);
          return;
        }

        const wildcardDomains = await prisma.siteDomain.findMany({
          where: { domain: { startsWith: "*." } },
          select: { domain: true },
        });
        if (wildcardDomains.some((entry) => wildcardMatches(parsedOrigin.hostname, entry.domain.toLowerCase()))) {
          callback(null, true);
          return;
        }
      } catch {
        callback(new Error("Gagal memvalidasi origin CORS."), false);
        return;
      }

      callback(new Error("Origin tidak diizinkan oleh kebijakan CORS."), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SolidChat AI API")
    .setDescription("Live chat customer service API for PT Solid Gold Berjangka")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = config.get<number>("API_PORT") ?? 4000;
  await app.listen(port, "0.0.0.0");
  console.log(`SolidChat API listening on port ${port}`);
}

bootstrap();
