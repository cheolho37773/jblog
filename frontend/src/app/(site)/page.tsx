import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Container } from '@/components/layout/Container';
import { Button } from '@/components/ui/Button';
import { FeaturedHeroCard } from '@/features/posts/components/FeaturedHeroCard';
import { PostCardGrid } from '@/features/posts/components/PostCardGrid';
import { POST_GRID_CLASS } from '@/features/posts/components/post-grid-class';
import { env } from '@/lib/env';
import { loadHomePosts } from '@/features/posts/lib/home-api';

export const metadata: Metadata = {
  alternates: { canonical: new URL('/', env.public.NEXT_PUBLIC_SITE_URL) },
};

export default async function HomePage() {
  // 요청 시 렌더: 빌드(백엔드 없음)에서 조회하지 않게 한다 (프론트엔드 §4 "빌드와 데이터").
  await connection();
  const { featured, latest } = await loadHomePosts();

  return (
    <Container className="pt-6 pb-25">
      {/* sr-only의 margin -1px을 지워 Navbar 아래 24 간격 측정이 어긋나지 않게 한다. M4 Profile Hero가 보이는 h1을 가져가면 지운다 */}
      <h1 className="sr-only m-0!">jblog</h1>
      {featured && (
        <div className="mb-20">
          <FeaturedHeroCard post={featured} headingLevel={2} />
        </div>
      )}
      <section>
        <h2 className="text-h3-bold text-strong mb-8">Latest Post</h2>
        {latest.length === 0 ? (
          <p className="text-h4 text-strong py-16 text-center">아직 글이 없습니다</p>
        ) : (
          <>
            <ul aria-label="최신 글" className={POST_GRID_CLASS}>
              {latest.map((post) => (
                <li key={post.slug}>
                  <PostCardGrid post={post} headingLevel={3} />
                </li>
              ))}
            </ul>
            <div className="mt-8 flex justify-center">
              <Button asChild variant="outline">
                <Link href="/blog">View All Post</Link>
              </Button>
            </div>
          </>
        )}
      </section>
    </Container>
  );
}
