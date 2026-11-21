// 통합 테스트용 DB 헬퍼 (M0-06 "테스트 대상 인터페이스"). 컨테이너는 globalSetup(test/setup-integration.ts)이 띄우고,
// 여기서는 그 빈 DB에 마이그레이션을 적용하고 앱과 같은 Prisma 클라이언트를 만든다.
//
// 접속 URL에는 비밀번호가 들어 있으므로 로그·오류 메시지에 그대로 내보내지 않는다 (개요 §6-b).
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { seedDatabase } from '../../prisma/seed';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createPrismaAdapter } from '../../src/prisma/prisma-adapter';
import { readIntegrationDatabaseUrl } from '../setup-integration-database';

export interface IntegrationDatabase {
  databaseUrl: string;
  prisma: PrismaClient;
}

const execFileAsync = promisify(execFile);

// Prisma CLI는 backend/prisma.config.ts를 작업 폴더에서 찾는다.
const BACKEND_DIR = resolve(__dirname, '../..');
const PRISMA_CLI = require.resolve('prisma/build/index.js');
// 마이그레이션 이력 테이블. 비우면 다음 migrate deploy가 이미 있는 테이블을 다시 만들려다 실패한다.
const MIGRATIONS_TABLE = '_prisma_migrations';
const REDACTED = '[redacted]';

// 자식 프로세스에는 필요한 값만 넘긴다. 부모 환경(process.env)을 물려주지 않으므로 다른 비밀값이 섞이지 않고,
// 설정 모듈 밖 process.env 금지 규칙(개요 §6-b)도 지킨다. node는 절대 경로로 실행해 PATH가 필요 없다.
function prismaCliEnv(databaseUrl: string): Record<string, string> {
  return {
    DATABASE_URL: databaseUrl,
    // 업데이트 확인·사용 통계 전송을 끈다. 테스트 결과가 네트워크에 좌우되지 않게 한다.
    CHECKPOINT_DISABLE: '1',
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };
}

function redactDatabaseUrl(text: string, databaseUrl: string): string {
  const password = decodeURIComponent(new URL(databaseUrl).password);
  const redacted = text.split(databaseUrl).join(REDACTED);
  return password === '' ? redacted : redacted.split(password).join(REDACTED);
}

// 실패 시 Prisma 출력은 원인 파악에 필요하므로 남기되, 접속 정보는 가린다.
// 원래 오류 객체는 cause로 잇지 않는다: 출력 원문이 그대로 들어 있어 가린 의미가 없어진다.
async function applyMigrations(databaseUrl: string): Promise<void> {
  let failureOutput: string | undefined;
  try {
    await execFileAsync(process.execPath, [PRISMA_CLI, 'migrate', 'deploy'], {
      cwd: BACKEND_DIR,
      env: prismaCliEnv(databaseUrl),
    });
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    failureOutput = `${stdout}\n${stderr}`;
  }
  if (failureOutput !== undefined) {
    throw new Error(
      `prisma migrate deploy 실패:\n${redactDatabaseUrl(failureOutput, databaseUrl)}`,
    );
  }
}

function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: createPrismaAdapter(databaseUrl) });
}

/**
 * 통합 테스트 DB에 마이그레이션을 적용하고 새 클라이언트를 돌려준다.
 * 여러 번 불러도 된다(migrate deploy는 적용된 마이그레이션을 건너뛴다). 호출마다 클라이언트가 따로 생기므로
 * 하나를 닫아도 다른 것은 계속 쓸 수 있다.
 */
export async function prepareIntegrationDatabase(): Promise<IntegrationDatabase> {
  const databaseUrl = readIntegrationDatabaseUrl();
  await applyMigrations(databaseUrl);
  return { databaseUrl, prisma: createPrismaClient(databaseUrl) };
}

/** 앱 테이블의 데이터만 비운다. 스키마·확장·인덱스·마이그레이션 이력은 그대로 둔다. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> ${MIGRATIONS_TABLE}`;
  if (rows.length === 0) return;

  // 테이블 이름은 사용자 입력이 아니라 시스템 카탈로그에서 읽은 값이다. 식별자는 큰따옴표로 감싼다.
  const tables = rows.map((row) => `"public"."${row.tablename.replaceAll('"', '""')}"`).join(', ');
  // 외래 키로 엮인 테이블을 한 번에 비우고(CASCADE), 자동 증가 값도 처음으로 돌린다.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

/** prisma/seed.ts와 같은 seed를 주어진 DB에 실행한다. */
export async function runSeed(databaseUrl: string): Promise<void> {
  const prisma = createPrismaClient(databaseUrl);
  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// createApp에 넘길 환경값. 포트는 listen하지 않으므로 의미 없는 더미 값이다.
const DUMMY_API_PORT = '4000';

export function createIntegrationEnv(databaseUrl: string): Record<string, unknown> {
  return { NODE_ENV: 'test', API_PORT: DUMMY_API_PORT, DATABASE_URL: databaseUrl };
}

export async function closeIntegrationDatabase(db: IntegrationDatabase): Promise<void> {
  await db.prisma.$disconnect();
}
