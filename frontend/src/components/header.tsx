"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
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
  const pathname = usePathname();

  function closeMenu() {
    setMenuOpen(false);
  }

  let listsLink = null;
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
    listsLink = (
      <Link href="/my-lists" onClick={closeMenu}>
        My Lists
      </Link>
    );
    accountLinks = (
      <Button asChild className="nav-signup">
        <Link href="/account" onClick={closeMenu}>
          My Account
        </Link>
      </Button>
    );
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
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
            Home
          </Link>
          <Link
            href="/discover"
            aria-current={pathname === "/discover" ? "page" : undefined}
          >
            Discover
          </Link>
          {listsLink}
        </nav>
        <nav className="account-navigation" aria-label="Account navigation">
          {accountLinks}
        </nav>
        <div className="mobile-navigation">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="menu-button"
                aria-label="Menu"
              >
                <MenuIcon aria-hidden="true" />
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
                {listsLink}
                {accountLinks}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
