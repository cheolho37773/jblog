import { Container } from '@/components/layout/Container';
import { PageInfo } from '@/components/layout/PageInfo';
import { POST_GRID_CLASS } from '@/features/posts/components/post-grid-class';
import { PostCardSkeleton } from '@/features/posts/components/PostCardSkeleton';

const SKELETON_COUNT = 9;

export default function BlogLoading() {
  return (
    <Container className="pt-6 pb-16">
      <PageInfo title="Blog" breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Blog' }]} />
      <div data-testid="blog-loading-grid" className={`mt-12 ${POST_GRID_CLASS}`}>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <PostCardSkeleton key={index} />
        ))}
      </div>
    </Container>
  );
}
