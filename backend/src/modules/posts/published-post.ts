import { PostStatus, Prisma } from '../../generated/prisma/client';

// 공개 조건의 단일 정의: PUBLISHED 이면서 발행 시각이 지난 글만 공개한다 (백엔드 §5.1).
// 초안·예약(미래 publishedAt)은 목록·상세·카운트·검색·이전/다음·관련 글 어디에도 나오면 안 되므로,
// 공개 조회는 반드시 이 조건을 거친다. 같은 조건을 Prisma 쿼리용과 raw SQL용으로 나란히 둔다.
//
// asOf(공개 기준 시각)는 요청당 한 번 정해 그 요청의 모든 조회에 같은 값을 넘긴다.
// 조회마다 시각을 새로 읽으면 예약 글의 발행 시각이 요청 도중 지나가, 같은 응답 안에서
// 목록·카운트·이웃 글이 서로 어긋난다. 누락을 막으려고 기본값 없는 필수 인자로 둔다.

export function publishedPostWhere(asOf: Date): Prisma.PostWhereInput {
  return { status: PostStatus.PUBLISHED, publishedAt: { lte: asOf } };
}

// 검색(raw SQL) 전용. 테이블 별칭 없이 "Post" 컬럼을 그대로 쓴다. asOf는 바인딩 파라미터다.
export function publishedPostSql(asOf: Date): Prisma.Sql {
  return Prisma.sql`status = 'PUBLISHED' AND "publishedAt" <= ${asOf}`;
}

// 목록·이전/다음 글의 정렬. 같은 시각에 발행된 글은 id가 큰 쪽이 더 최근이다.
export const NEWEST_FIRST: Prisma.PostOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
];
