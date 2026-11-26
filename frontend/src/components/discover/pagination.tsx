import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { discoverUrl, maxPage } from "@/lib/catalog";
import type { DiscoverParams, PaginationMeta } from "@/lib/catalog";

interface PaginationProps {
  params: DiscoverParams;
  meta: PaginationMeta;
}

export default function Pagination(props: PaginationProps) {
  const page = props.meta.page;
  let totalPages = Math.ceil(props.meta.total / props.meta.page_size);

  // the backend does not serve pages past 500
  if (totalPages > maxPage) {
    totalPages = maxPage;
  }

  if (totalPages < page) {
    totalPages = page;
  }

  const hasPrevious = page > 1;
  const hasNext = props.meta.has_next && page < maxPage;

  if (!hasPrevious && !hasNext) {
    return null;
  }

  let previous = (
    <span className="discover-page-link" aria-disabled="true">
      <ChevronLeft aria-hidden="true" />
      Previous
    </span>
  );

  let next = (
    <span className="discover-page-link" aria-disabled="true">
      Next
      <ChevronRight aria-hidden="true" />
    </span>
  );

  if (hasPrevious) {
    previous = (
      <Link
        className="discover-page-link"
        href={discoverUrl({ ...props.params, page: page - 1 })}
        rel="prev"
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Link>
    );
  }

  if (hasNext) {
    next = (
      <Link
        className="discover-page-link"
        href={discoverUrl({ ...props.params, page: page + 1 })}
        rel="next"
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Link>
    );
  }

  return (
    <nav className="discover-pagination" aria-label="Search results pages">
      {previous}
      <span className="discover-page-status">
        Page {page} of {totalPages}
      </span>
      {next}
    </nav>
  );
}
