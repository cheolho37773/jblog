import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MinLength,
  Min,
  registerDecorator,
  type ValidationOptions,
  validateSync,
} from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

const MIN_PORT = 1;
const MAX_PORT = 65535;
// 내부 API 키의 최소 길이. 추측하기 쉬운 짧은 값을 막는다.
const MIN_INTERNAL_API_KEY_LENGTH = 16;
const DIGITS_ONLY = /^\d+$/;

// node-postgres(Prisma 드라이버 어댑터)가 받는 스킴. Testcontainers는 postgres://를 쓴다.
const DATABASE_URL_PROTOCOLS = ['postgres:', 'postgresql:'];

// 환경변수는 항상 문자열로 들어온다. 숫자만으로 된 문자열만 변환해서
// '40.5'·'4e3'·''·'abc' 같은 값은 변환하지 않고 검증에서 거부한다.
function toPortNumber({ value }: { value: unknown }): unknown {
  if (typeof value === 'string' && DIGITS_ONLY.test(value)) return Number(value);
  return value;
}

// class-validator의 IsUrl은 기본 옵션에서 postgres 스킴·TLD 없는 호스트(localhost)·자격 정보를 거부하므로
// URL 파서로 직접 확인한다. 스킴과 호스트만 본다: 사용자·비밀번호·쿼리 파라미터는 환경마다 다르다.
export function isDatabaseUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !URL.canParse(value)) return false;
  const url = new URL(value);
  return DATABASE_URL_PROTOCOLS.includes(url.protocol) && url.hostname !== '';
}

// 메시지에는 규칙만 담는다. 값에 비밀번호가 들어 있으므로 $value를 쓰지 않는다.
function IsDatabaseUrl(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isDatabaseUrl',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: '$property must be a postgres:// or postgresql:// URL with a host',
        ...options,
      },
      validator: { validate: isDatabaseUrl },
    });
  };
}

export class AppEnv {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV!: NodeEnvironment;

  @Transform(toPortNumber)
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  API_PORT!: number;

  // 접속 정보(비밀번호 포함). 로그·에러 메시지에 출력하지 않는다 (개요 §6-b).
  @IsDatabaseUrl()
  DATABASE_URL!: string;

  // 프론트 서버가 /internal/*을 부를 때 쓰는 공유 키(비밀값). 메시지에는 이름만 담는다(개요 §6-b).
  @IsString()
  @MinLength(MIN_INTERNAL_API_KEY_LENGTH)
  INTERNAL_API_KEY!: string;
}

// 기본값을 채우지 않는다: 없거나 틀리면 부팅을 실패시킨다.
// 메시지에는 변수 이름과 규칙만 담고 입력값은 담지 않는다(민감 정보 유출 방지).
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const env = plainToInstance(AppEnv, raw);
  const errors = validateSync(env);
  if (errors.length === 0) return env;

  const problems = errors.map((error) => Object.values(error.constraints ?? {}).join(', '));
  throw new Error(`환경변수가 올바르지 않습니다: ${problems.join('; ')}`);
}
