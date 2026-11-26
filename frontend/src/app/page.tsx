import HomeHero from "@/components/home/home-hero";
import HomeCatalog from "@/components/home/home-catalog";
import "@/components/home/home.css";

export default function HomePage() {
  return (
    <main id="main" className="home-main">
      <HomeHero />
      <HomeCatalog />
    </main>
  );
}
