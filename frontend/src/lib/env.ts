import 'server-only';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { parseBuildEnv, parseEnv, type ServerEnv } from './env.schema';

// process.env를 읽는 유일한 곳이다 (개요 §6-b). 서버 컴포넌트·Route Handler에서만 가져온다.
//
// 공개 값(SITE_URL 등)은 빌드 중 layout도 쓰므로 빌드용 검증으로 바로 읽는다.
// 서버 값은 INTERNAL_API_KEY를 포함한 전체 검증이며, 빌드는 키 없이 통과해야 하므로
// 빌드 단계에서는 검증하지 않는다. 운영 서버는 기동 시 instrumentation이 verifyRuntimeEnv로
// 한 번 검증해 키가 없으면 뜨지 못한다. 오류 메시지에는 변수 이름만 담긴다.
const buildEnv = parseBuildEnv(process.env);

let runtimeServerEnv: ServerEnv | undefined;

function readRuntimeServerEnv(): ServerEnv {
  runtimeServerEnv ??= parseEnv(process.env).server;
  return runtimeServerEnv;
}

// 서버 기동 시 instrumentation에서 부른다. Edge 런타임과 빌드(next build의 작업자 포함)는 건너뛴다.
export function verifyRuntimeEnv(): void {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;
  readRuntimeServerEnv();
}

export const env = {
  public: buildEnv.public,
  get server(): ServerEnv {
    return readRuntimeServerEnv();
  },
};
