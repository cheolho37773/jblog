import { plainToInstance, Transform } from 'class-transformer';
import { IsIn, IsInt, Max, Min, validateSync } from 'class-validator';

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

const MIN_PORT = 1;
const MAX_PORT = 65535;
const DIGITS_ONLY = /^\d+$/;

// 환경변수는 항상 문자열로 들어온다. 숫자만으로 된 문자열만 변환해서
// '40.5'·'4e3'·''·'abc' 같은 값은 변환하지 않고 검증에서 거부한다.
function toPortNumber({ value }: { value: unknown }): unknown {
  if (typeof value === 'string' && DIGITS_ONLY.test(value)) return Number(value);
  return value;
}

export class AppEnv {
  @IsIn(NODE_ENVIRONMENTS)
  NODE_ENV!: NodeEnvironment;

  @Transform(toPortNumber)
  @IsInt()
  @Min(MIN_PORT)
  @Max(MAX_PORT)
  API_PORT!: number;
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
