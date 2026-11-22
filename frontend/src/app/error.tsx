"use client";

import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  reset: () => void;
}

export default function ErrorPage(props: ErrorPageProps) {
  return (
    <main id="main" className="content-page">
      <h1>We could not load this page.</h1>
      <p>The service may be unavailable. Please try again.</p>
      <Button
        variant="outline"
        type="button"
        className="secondary-button"
        onClick={props.reset}
      >
        Try Again
      </Button>
    </main>
  );
}
