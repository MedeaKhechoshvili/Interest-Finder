import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-content">
        <div>
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
        <nav aria-label="Footer navigation">
          <Link href="/discover">Discover</Link>
          <Link href="/account">My Account</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </div>
      <p className="copyright">
        © {year} InterestFinder. Designed for intentional exploration.
      </p>
    </footer>
  );
}
