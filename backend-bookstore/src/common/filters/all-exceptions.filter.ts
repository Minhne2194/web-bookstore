import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

interface ErrorPayload {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, message } = this.normalize(exception);

    const payload: ErrorPayload = {
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(payload);
  }

  private normalize(
    exception: unknown,
  ): Pick<ErrorPayload, 'statusCode' | 'error' | 'message'> {
    if (exception instanceof HttpException) {
      return this.normalizeHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.normalizePrismaKnownError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Dữ liệu gửi lên không hợp lệ',
      };
    }

    console.error('Lỗi không xác định:', exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Lỗi máy chủ nội bộ',
    };
  }

  private normalizeHttpException(
    exception: HttpException,
  ): Pick<ErrorPayload, 'statusCode' | 'error' | 'message'> {
    const statusCode = exception.getStatus();
    const defaultError = AllExceptionsFilter.statusName(statusCode);
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { statusCode, error: defaultError, message: response };
    }

    if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>;
      const message =
        typeof body.message === 'string' || Array.isArray(body.message)
          ? (body.message as string | string[])
          : defaultError;
      const error =
        typeof body.error === 'string' && body.error.length > 0
          ? body.error
          : defaultError;
      return { statusCode, error, message };
    }

    return { statusCode, error: defaultError, message: defaultError };
  }

  private normalizePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Pick<ErrorPayload, 'statusCode' | 'error' | 'message'> {
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const fields = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : '';
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: fields
          ? `Dữ liệu trùng lặp ở trường: ${fields}`
          : 'Dữ liệu trùng lặp',
      };
    }

    if (exception.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Không tìm thấy bản ghi yêu cầu',
      };
    }

    console.error('Lỗi Prisma chưa xử lý:', exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Lỗi máy chủ nội bộ',
    };
  }

  private static statusName(statusCode: number): string {
    const names: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'Bad Request',
      [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
      [HttpStatus.PAYMENT_REQUIRED]: 'Payment Required',
      [HttpStatus.FORBIDDEN]: 'Forbidden',
      [HttpStatus.NOT_FOUND]: 'Not Found',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
      [HttpStatus.CONFLICT]: 'Conflict',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
      [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
      [HttpStatus.NOT_IMPLEMENTED]: 'Not Implemented',
      [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    };
    return names[statusCode] ?? `Error ${statusCode}`;
  }
}
