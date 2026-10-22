import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

// Unit test chạy offline: đảm bảo có DATABASE_URL giả để constructor không throw
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://test:test@localhost:5432/test?schema=public';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
