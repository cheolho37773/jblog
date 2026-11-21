import createClient from 'openapi-fetch';
import type { paths } from '@/generated/api-types';

// 브라우저는 같은 오리진의 상대 경로(/api/...)로 호출한다. 인증·CSRF·refresh는 M3에서 추가한다.
export const browserApi = createClient<paths>({ baseUrl: '' });
