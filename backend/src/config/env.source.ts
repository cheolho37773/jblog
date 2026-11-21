import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

// 모듈 위치 기준으로 backend/.env를 찾는다. 작업 폴더 기준이면 루트에서
// `node backend/dist/main.js`처럼 실행할 때 다른 파일을 찾는다. src/config와
// dist/config는 깊이가 같아 개발·빌드 결과 모두 같은 파일을 가리킨다.
const ENV_FILE_PATH = join(__dirname, '..', '..', '.env');

// instanceof Error는 테스트(VM) 환경에서 realm이 달라 실패하므로 code만 확인한다.
function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
}

// 파일이 없으면 환경변수만 쓰는 환경(CI·컨테이너)이므로 조용히 건너뛴다.
// 다른 오류의 원인 객체에는 경로가 들어 있으므로 catch 밖에서 일반 메시지로 던진다.
export function readEnvFile(path: string): Record<string, string> {
  let content: string;
  let failureCode: unknown;
  try {
    content = readFileSync(path, 'utf8');
  } catch (error) {
    failureCode = errorCode(error) ?? 'UNKNOWN';
    content = '';
  }
  if (failureCode === 'ENOENT') return {};
  if (failureCode !== undefined)
    throw new Error('.env 파일을 읽을 수 없습니다', { cause: failureCode });
  return parseEnv(content) as Record<string, string>;
}

// 프로세스(셸) 값이 파일 값보다 우선한다(Node --env-file과 같은 규칙).
// undefined인 프로세스 값은 없는 것으로 보고 파일 값을 남긴다.
export function mergeEnvSources(
  fileEnv: Record<string, string>,
  processEnv: Record<string, string | undefined>,
): Record<string, unknown> {
  const definedProcessEnv = Object.entries(processEnv).filter(([, value]) => value !== undefined);
  return { ...fileEnv, ...Object.fromEntries(definedProcessEnv) };
}

// process.env를 읽는 유일한 곳. 나머지 코드는 검증된 AppEnv만 받는다.
export function readProcessEnv(): Record<string, unknown> {
  return mergeEnvSources(readEnvFile(ENV_FILE_PATH), process.env);
}
