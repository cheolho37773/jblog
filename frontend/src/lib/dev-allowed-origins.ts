const VARIABLE_NAME = 'JBLOG_DEV_ALLOWED_ORIGINS';

// 스킴(`http://`)이나 경로(`/`)가 붙은 값. Next의 allowedDevOrigins는 호스트만 받는다.
const HAS_SCHEME_OR_PATH = /:\/\/|\//;

// 쉼표로 구분한 호스트 목록을 배열로 바꾼다. 앞뒤 공백과 빈 항목은 버린다.
// 잘못된 값은 개발 서버 시작 단계에서 바로 알 수 있도록 오류로 멈춘다.
export function parseDevAllowedOrigins(raw?: string): string[] {
  if (!raw) return [];

  const hosts = raw
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '');

  const invalid = hosts.find((host) => HAS_SCHEME_OR_PATH.test(host));
  if (invalid) {
    throw new Error(
      `${VARIABLE_NAME}에는 호스트만 쓸 수 있습니다(예: 192.168.0.10,my-mac.local). 스킴과 경로는 뺍니다: "${invalid}"`,
    );
  }

  return hosts;
}
