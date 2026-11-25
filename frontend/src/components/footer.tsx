import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div className="footer-about">
          <Link href="/" className="brand">
            <span className="brand-icon" aria-hidden="true">
              i
            </span>
            <span>InterestFinder</span>
          </Link>
          <p>
            Your calm companion for digital curation. Save, organize, and
            discover what moves you across literature, cinema, sound, and space.
          </p>
        </div>
        <div className="footer-columns">
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <Link href="/discover?category=movies">Cinema</Link>
            <Link href="/discover?category=books">Literature</Link>
            <Link href="/discover?category=music">Audio &amp; Sound</Link>
            <Link href="/discover?category=attractions">Local Escapes</Link>
          </nav>
          <div className="footer-column">
            <h2>Platform</h2>
            <span>Our Philosophy</span>
            <span>Curators</span>
            <span>Guides</span>
            <span>FAQ</span>
          </div>
          <nav aria-label="Legal">
            <h2>Legal</h2>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>Guidelines</span>
          </nav>
        </div>
      </div>
      <p className="copyright">
        © {year} InterestFinder Platform. Designed for intentional exploration.
      </p>
    </footer>
  );
}
