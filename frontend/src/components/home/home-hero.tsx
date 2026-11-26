import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { homeCategories } from "@/lib/home";

export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <h1 id="home-title">
        <span className="home-desktop-title">Your discovery companion</span>
        <span className="home-mobile-title">Find what moves you</span>
      </h1>
      <p className="home-tagline">
        Find what moves <span>you</span>
      </p>
      <form
        className="home-search"
        action="/discover"
        method="get"
        role="search"
      >
        <Search aria-hidden="true" />
        <label htmlFor="home-search" className="sr-only">
          Search movies, books, music, and attractions
        </label>
        <Input
          id="home-search"
          name="q"
          type="search"
          maxLength={200}
          placeholder="Search movies, books, music, attractions..."
        />
        <Button type="submit">Search</Button>
      </form>
      <nav className="home-categories" aria-label="Browse by category">
        {homeCategories.map(function (category) {
          return (
            <Button asChild variant="outline" key={category.value}>
              <Link href={"/discover?category=" + category.value}>
                {category.label}
              </Link>
            </Button>
          );
        })}
      </nav>
    </section>
  );
}
