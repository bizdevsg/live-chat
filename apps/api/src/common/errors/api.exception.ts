import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@solidchat/shared";

/** Thrown anywhere in the app; ApiExceptionFilter turns it into the §38 error envelope. */
export class ApiException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

export class NotFoundApiException extends ApiException {
  constructor(code: ErrorCode, message: string) {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ForbiddenApiException extends ApiException {
  constructor(message = "Anda tidak memiliki akses untuk tindakan ini.") {
    super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

export class UnauthorizedApiException extends ApiException {
  constructor(message = "Autentikasi diperlukan.") {
    super(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}
