"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface HeaderProps {
  signedIn: boolean;
}

export default function Header(props: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  let accountLinks = (
    <>
      <Link href="/login" onClick={closeMenu}>
        Log In
      </Link>
      <Button asChild className="nav-signup">
        <Link href="/register" onClick={closeMenu}>
          Sign Up
        </Link>
      </Button>
    </>
  );

  if (props.signedIn) {
    accountLinks = (
      <Button asChild className="nav-signup">
        <Link href="/account" onClick={closeMenu}>
          My Account
        </Link>
      </Button>
    );
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="header-content">
        <Link href="/" className="brand" onClick={closeMenu}>
          <span className="brand-icon" aria-hidden="true">
            i
          </span>
          <span>InterestFinder</span>
        </Link>

        <nav className="site-navigation" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/discover">Discover</Link>
          <Link href="/my-lists">My Lists</Link>
          {accountLinks}
        </nav>

        <div className="mobile-navigation">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="menu-button">
                Menu
              </Button>
            </SheetTrigger>
            <SheetContent className="mobile-sheet">
              <SheetHeader>
                <SheetTitle>InterestFinder</SheetTitle>
                <SheetDescription>
                  Explore your interests or manage your account.
                </SheetDescription>
              </SheetHeader>
              <nav className="mobile-menu" aria-label="Mobile navigation">
                <Link href="/" onClick={closeMenu}>
                  Home
                </Link>
                <Link href="/discover" onClick={closeMenu}>
                  Discover
                </Link>
                <Link href="/my-lists" onClick={closeMenu}>
                  My Lists
                </Link>
                {accountLinks}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
