// Prisma CLI 설정 (Prisma 7). migrate·db seed·generate가 이 파일을 읽는다.
//
// Prisma 7은 .env를 스스로 읽지 않고, 스키마의 datasource에 url을 두지 않는다.
// 앱과 같은 규칙(backend/.env + 셸 값, 셸 값 우선)으로 DATABASE_URL을 읽어 넘긴다 (개요 §6-b).
// 값이 없으면 넘기지 않는다: generate는 DB 없이 돌아야 하고, DB가 필요한 명령은 Prisma가 이름을 알려 주며 실패한다.
import { defineConfig } from 'prisma/config';
import { readProcessEnv } from './src/config/env.source';

function readDatabaseUrl(): string | undefined {
  const value = readProcessEnv().DATABASE_URL;
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: { url: readDatabaseUrl() },
});
