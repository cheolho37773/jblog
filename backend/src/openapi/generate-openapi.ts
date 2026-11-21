import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApiDocument, createApp } from '../bootstrap';
import { sortKeysDeep } from './sort-keys';

// 문서 출력용 더미 환경값. 서버를 띄우지 않고 DB에도 연결하지 않으므로 비밀값이 아니다.
const OPENAPI_ENV = {
  NODE_ENV: 'development',
  API_PORT: '3000',
  DATABASE_URL: 'postgresql://localhost:5432/openapi_generate',
};

const JSON_INDENT = 2;
// dist/openapi/ 또는 src/openapi/에서 backend/ 루트로 올라간다.
const OUTPUT_PATH = join(__dirname, '..', '..', 'openapi.json');

// listen하지 않고 createApp과 같은 모듈 구성으로 문서만 만든다.
async function generateOpenApi(): Promise<void> {
  const app = await createApp(OPENAPI_ENV);
  try {
    const document = sortKeysDeep(createApiDocument(app));
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, JSON_INDENT)}\n`);
  } finally {
    await app.close();
  }
}

void generateOpenApi();
