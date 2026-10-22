import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockGetResponse: jest.Mock;
  let mockGetRequest: jest.Mock;
  let mockArgumentsHost: ArgumentsHost;

  const expectErrorShape = (payload: any) => {
    expect(Object.keys(payload).sort()).toEqual([
      'error',
      'message',
      'path',
      'statusCode',
      'timestamp',
    ]);
    expect(typeof payload.timestamp).toBe('string');
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
  };

  const getPayload = () => mockJson.mock.calls[0][0];

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    mockGetRequest = jest.fn().mockReturnValue({ url: '/api/test' });
    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HttpException', () => {
    it('should keep status and string message', () => {
      filter.catch(
        new HttpException('Không tìm thấy', HttpStatus.NOT_FOUND),
        mockArgumentsHost,
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: 'Không tìm thấy',
          path: '/api/test',
        }),
      );
      expectErrorShape(getPayload());
    });

    it('should keep the response error name when present', () => {
      filter.catch(
        new UnauthorizedException('Sai mật khẩu'),
        mockArgumentsHost,
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Sai mật khẩu',
        }),
      );
    });

    it('should preserve ValidationPipe message array as-is', () => {
      filter.catch(
        new BadRequestException([
          'Email không hợp lệ',
          'Mật khẩu tối thiểu 6 ký tự',
        ]),
        mockArgumentsHost,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          message: ['Email không hợp lệ', 'Mật khẩu tối thiểu 6 ký tự'],
          path: '/api/test',
        }),
      );
      expectErrorShape(getPayload());
    });
  });

  describe('Prisma.PrismaClientKnownRequestError', () => {
    it('should map P2002 to 409 Conflict with the duplicated field name', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['email', 'phone'] },
        },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          error: 'Conflict',
          message: 'Dữ liệu trùng lặp ở trường: email, phone',
          path: '/api/test',
        }),
      );
      expectErrorShape(getPayload());
    });

    it('should map P2025 to 404 Not Found', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: 'test' },
      );

      filter.catch(error, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          error: 'Not Found',
          message: 'Không tìm thấy bản ghi yêu cầu',
        }),
      );
      expectErrorShape(getPayload());
    });
  });

  describe('Prisma.PrismaClientValidationError', () => {
    it('should map to 400 Bad Request', () => {
      const error = new Prisma.PrismaClientValidationError('Invalid value', {
        clientVersion: 'test',
      });

      filter.catch(error, mockArgumentsHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Dữ liệu gửi lên không hợp lệ',
        }),
      );
      expectErrorShape(getPayload());
    });
  });

  describe('Unknown errors', () => {
    it('should map to 500 Internal Server Error and log to console', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      filter.catch(new Error('Unexpected failure'), mockArgumentsHost);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Lỗi máy chủ nội bộ',
          path: '/api/test',
        }),
      );
      expectErrorShape(getPayload());

      consoleErrorSpy.mockRestore();
    });
  });
});
