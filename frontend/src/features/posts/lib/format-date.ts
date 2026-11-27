const SEOUL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 발행 시각(ISO)을 서울 기준 날짜 `2026.01.05` 형식으로 바꾼다. 서버·브라우저의 시간대와 무관하다. */
export function formatPublishedDate(isoDateTime: string): string {
  return SEOUL_DATE_FORMAT.format(new Date(isoDateTime)).replaceAll('-', '.');
}

/** 읽는 시간 문구. 1분 미만으로 계산된 값(0 이하)도 "1 min read"로 보여 준다. */
export function formatReadingTime(minutes: number): string {
  return `${Math.max(1, minutes)} min read`;
}
