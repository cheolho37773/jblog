import { z } from 'zod';
import { publicSchema } from './env.public-schema';

// 비밀값처럼 보이는 이름은 NEXT_PUBLIC_ 으로 노출하면 브라우저에 공개된다 (개요 §6-b).
const SECRET_NAME_PATTERN = /SECRET|TOKEN|KEY|PASSWORD|SALT|JWT_|DATABASE_URL/;

// 내부 API 키의 최소 길이. 추측하기 쉬운 짧은 값을 막는다.
const INTERNAL_API_KEY_MIN_LENGTH = 16;

// 빌드에 필요한 서버 변수. 키 같은 비밀값은 빌드에 필요 없으므로 넣지 않는다 (M2-E 규약 4).
const buildServerSchema = z.object({
  API_INTERNAL_URL: z.url(),
});

// 런타임 서버 변수. INTERNAL_API_KEY는 서버 스키마에만 두고 NEXT_PUBLIC_*에는 두지 않는다.
const serverSchema = buildServerSchema.extend({
  INTERNAL_API_KEY: z.string().min(INTERNAL_API_KEY_MIN_LENGTH),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type BuildServerEnv = z.infer<typeof buildServerSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

export const PUBLIC_ENV_KEYS: readonly string[] = Object.keys(publicSchema.shape);

export function findSecretLikePublicKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => SECRET_NAME_PATTERN.test(key));
}

// 이름만 담는다 (값 없음). 모듈이 로드될 때 호출해 위험한 공개 변수가 있으면 빌드·기동을 막는다.
export function assertPublicKeysSafe(keys: readonly string[]): void {
  const secretLikeKeys = findSecretLikePublicKeys(keys);
  if (secretLikeKeys.length > 0) {
    throw new Error(`비밀값처럼 보이는 공개 환경변수 이름: ${secretLikeKeys.join(', ')}`);
  }
}

assertPublicKeysSafe(PUBLIC_ENV_KEYS);

// 오류 메시지에는 변수 이름만 담는다. 입력 값(주소 등)을 로그에 남기지 않기 위해서다.
// 우리가 직접 쓴 규칙(custom) 위반은 입력 값이 없는 이유 문구를 이름 뒤에 붙여 원인을 알 수 있게 한다.
function invalidNames(error: z.ZodError): string[] {
  const names = error.issues.map((issue) => {
    const name = String(issue.path[0]);
    return issue.code === 'custom' ? `${name} (${issue.message})` : name;
  });
  return [...new Set(names)];
}

function formatInvalidNames(errors: (z.ZodError | undefined)[]): string {
  const names = errors.flatMap((error) => (error ? invalidNames(error) : []));
  return `환경변수가 없거나 올바르지 않습니다: ${names.join(', ')}`;
}

export function parseEnv(raw: Record<string, unknown>): { server: ServerEnv; public: PublicEnv } {
  const server = serverSchema.safeParse(raw);
  const publicValues = publicSchema.safeParse(raw);

  if (!server.success || !publicValues.success) {
    throw new Error(formatInvalidNames([server.error, publicValues.error]));
  }
  return { server: server.data, public: publicValues.data };
}

// 빌드용: INTERNAL_API_KEY 없이 통과한다. 빌드는 API도 비밀값도 없이 돌아야 한다 (M2-E 규약 4).
export function parseBuildEnv(raw: Record<string, unknown>): {
  server: BuildServerEnv;
  public: PublicEnv;
} {
  const server = buildServerSchema.safeParse(raw);
  const publicValues = publicSchema.safeParse(raw);

  if (!server.success || !publicValues.success) {
    throw new Error(formatInvalidNames([server.error, publicValues.error]));
  }
  return { server: server.data, public: publicValues.data };
}
