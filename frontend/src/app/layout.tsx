import type { Metadata } from "next";
import type { ReactNode } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { AuthPromptProvider } from "@/components/auth-prompt";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterestFinder",
  description: "Discover movies, books, music, and places.",
  icons: { icon: "/icon.svg" },
};

interface LayoutProps {
  children: ReactNode;
}

export default async function RootLayout(props: LayoutProps) {
  let signedIn = false;

  try {
    const user = await getCurrentUser();

    if (user) {
      signedIn = true;
    }
  } catch {
    // the login page can still load when the backend is unavailable
    signedIn = false;
  }

  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AuthPromptProvider signedIn={signedIn}>
          <Header signedIn={signedIn} />
          {props.children}
          <Footer />
        </AuthPromptProvider>
      </body>
    </html>
  );
}
