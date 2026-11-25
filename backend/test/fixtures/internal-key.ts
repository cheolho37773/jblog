// 내부 API 키(INTERNAL_API_KEY) 테스트 더미 값. 비밀이 아니며 16자 이상이다(M2-04 규약 1).
// 로그·응답에 이 문자열이 나오는지 검사하므로 다른 값과 겹치지 않는 형태로 둔다.
export const TEST_INTERNAL_KEY = 'test-internal-key-not-secret';

export const INTERNAL_KEY_HEADER_NAME = 'X-Internal-Key';
