const VARIABLE_NAME = 'JBLOG_DEV_ALLOWED_ORIGINS';

// Next의 allowedDevOrigins는 요청 출처의 "호스트 이름"만 비교한다(스킴·포트·경로는 비교 대상이 아니다).
// 그래서 포트나 스킴이 붙은 값은 조용히 무시되어 접속이 계속 막힌다. 시작 단계에서 형식을 검사해 바로 알린다.
// 호스트 이름 라벨: 글자·숫자·`-`, 하이픈으로 시작·끝 금지(빈 라벨은 점이 연속되면 걸러진다).
const HOST_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
const HOSTNAME_PATTERN = new RegExp(`^(?:\\*\\.)?${HOST_LABEL}(?:\\.${HOST_LABEL})*$`);
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
// 대괄호가 있거나 콜론이 둘 이상이면 IPv6로 본다(콜론 하나는 포트).
const IPV6_PATTERN = /^\[.*\]$|:.*:/;

const FORMAT_HINT = '호스트만 쓸 수 있습니다(예: 192.168.0.10,my-mac.local,*.example.local)';

function isValidHost(host: string): boolean {
  return IPV4_PATTERN.test(host) || HOSTNAME_PATTERN.test(host);
}

function invalidHostError(host: string): Error {
  if (IPV6_PATTERN.test(host)) {
    return new Error(
      `${VARIABLE_NAME}에는 IPv4나 호스트 이름만 쓸 수 있습니다. IPv6는 지원하지 않습니다: "${host}"`,
    );
  }
  return new Error(
    `${VARIABLE_NAME}에는 ${FORMAT_HINT}. 스킴·포트·경로·쿼리·공백은 뺍니다: "${host}"`,
  );
}

// 쉼표로 구분한 호스트 목록을 배열로 바꾼다. 앞뒤 공백과 빈 항목은 버린다.
// 잘못된 값은 개발 서버 시작 단계에서 바로 알 수 있도록 오류로 멈춘다.
export function parseDevAllowedOrigins(raw?: string): string[] {
  if (!raw) return [];

  const hosts = raw
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host !== '');

  const invalid = hosts.find((host) => !isValidHost(host));
  if (invalid !== undefined) throw invalidHostError(invalid);

  return hosts;
}
