import 'server-only';
import { parseEnv } from './env.schema';

// process.env를 읽는 유일한 곳이다 (개요 §6-b). 서버 컴포넌트·Route Handler에서만 가져온다.
export const env = parseEnv(process.env);
