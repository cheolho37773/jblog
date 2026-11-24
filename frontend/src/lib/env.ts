import 'server-only';
import { parseBuildEnv, parseEnv, type ServerEnv } from './env.schema';

// process.env를 읽는 유일한 곳이다 (개요 §6-b). 서버 컴포넌트·Route Handler에서만 가져온다.
//
// 공개 값(SITE_URL 등)은 빌드 중 layout도 쓰므로 빌드용 검증으로 바로 읽는다.
// 서버 값은 INTERNAL_API_KEY를 포함한 전체 검증이며, 빌드는 키 없이 통과해야 하므로
// 처음 쓰는 요청 시점에 검증한다. 키가 없으면 그때 이름만 담은 오류로 실패한다.
const buildEnv = parseBuildEnv(process.env);

let runtimeServerEnv: ServerEnv | undefined;

function readRuntimeServerEnv(): ServerEnv {
  runtimeServerEnv ??= parseEnv(process.env).server;
  return runtimeServerEnv;
}

export const env = {
  public: buildEnv.public,
  get server(): ServerEnv {
    return readRuntimeServerEnv();
  },
};
