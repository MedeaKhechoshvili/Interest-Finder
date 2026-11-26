import type { Metadata } from "next";
import DiscoverForm from "@/components/discover/discover-form";
import DiscoverResults from "@/components/discover/discover-results";
import { discoverUrl, readDiscoverParams } from "@/lib/catalog";
import "./discover.css";

export const metadata: Metadata = {
  title: "Discover | InterestFinder",
};

interface DiscoverPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// the search lives in the url, so links, reloads, and back/forward keep it
export default async function DiscoverPage(props: DiscoverPageProps) {
  const params = readDiscoverParams(await props.searchParams);

  return (
    <main id="main" className="discover-page">
      <div className="discover-heading">
        <h1>Discover</h1>
        <p>Find movies, books, music, and places to explore next.</p>
      </div>
      <DiscoverForm initial={params} />
      {/* a new key starts a fresh request for each search or page */}
      <DiscoverResults key={discoverUrl(params)} params={params} />
    </main>
  );
}
