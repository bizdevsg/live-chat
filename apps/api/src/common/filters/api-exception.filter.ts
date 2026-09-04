import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorCode, type ApiErrorBody } from "@solidchat/shared";
import { ApiException } from "../errors/api.exception";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as Request & { requestId?: string }).requestId ?? "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = "Terjadi kesalahan pada server.";
    let details: unknown;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = this.codeForStatus(status);
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as { message?: string | string[] };
        message = Array.isArray(b.message) ? b.message.join(", ") : (b.message ?? message);
        details = Array.isArray(b.message) ? b.message : undefined;
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS && !response.getHeader("Retry-After")) {
        // Kebutuhan API Live Chat §12: 429 responses must carry Retry-After so Clara backs off correctly.
        response.setHeader("Retry-After", "30");
      }
    } else if (exception instanceof Error) {
      // Never leak stack traces to clients — internal log only (§38).
      this.logger.error(exception.message, exception.stack, requestId);
    }

    if (status >= 500) {
      this.logger.error(`[${requestId}] ${message}`, exception instanceof Error ? exception.stack : undefined);
    }

    const errorBody: ApiErrorBody = {
      success: false,
      error: { code, message, requestId, details },
    };
    response.status(status).json(errorBody);
  }

  /** Maps a raw HTTP status (thrown by a generic HttpException, e.g. ThrottlerException, NotFoundException) to a stable error code (§12). */
  private codeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.VALIDATION_ERROR;
    }
  }
}
