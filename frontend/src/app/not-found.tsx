import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main id="main" className="content-page">
      <h1>Page not found</h1>
      <p>We could not find this page.</p>
      <Link href="/login">Go to login</Link>
    </main>
  );
}
