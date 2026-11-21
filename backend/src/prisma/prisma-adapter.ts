import { PrismaPg } from '@prisma/adapter-pg';

// node-postgres의 연결 대기 기본값은 0(무한)이다. DB가 응답하지 않을 때 요청이 끝없이 걸리지 않도록
// Prisma 6까지의 기본 connect_timeout(5초)과 같은 값을 둔다.
const CONNECTION_TIMEOUT_MS = 5_000;

// Prisma 7은 드라이버 어댑터로 DB에 붙는다. 앱(PrismaService)·seed·통합 테스트가 같은 설정을 쓰도록 한 곳에 둔다.
// 풀은 첫 쿼리 때 연결한다.
export function createPrismaAdapter(databaseUrl: string): PrismaPg {
  return new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
}
