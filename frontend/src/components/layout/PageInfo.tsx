import Link from 'next/link';

type BreadcrumbItem = { label: string; href?: string };

type PageInfoProps = {
  title: string;
  breadcrumb: BreadcrumbItem[];
};

/** 목록 페이지 상단의 제목과 경로 (UI §5.7). 마지막 항목이 현재 위치라 링크로 만들지 않는다. */
export function PageInfo({ title, breadcrumb }: PageInfoProps) {
  const lastIndex = breadcrumb.length - 1;

  return (
    <div className="flex min-h-25 flex-col items-center justify-center gap-2 py-4">
      <h1 className="text-h3-bold text-strong">{title}</h1>
      <nav aria-label="현재 위치">
        <ol className="text-b4 flex items-center gap-3">
          {breadcrumb.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center gap-3">
              {index === lastIndex || !item.href ? (
                <span
                  aria-current={index === lastIndex ? 'page' : undefined}
                  className="text-muted"
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="text-body hover:text-primary-text">
                  {item.label}
                </Link>
              )}
              {index < lastIndex && (
                <span aria-hidden="true" className="bg-border-strong h-4 w-px" />
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
