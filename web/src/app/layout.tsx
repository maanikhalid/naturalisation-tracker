import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata: Metadata = {
  title: "UK Naturalisation Tracker",
  description: "Community tracker for Form AN processing timelines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="govuk-header" role="banner">
          <div className="govuk-header__container govuk-width-container">
            <div className="govuk-header__content">
              <Link href="/" className="govuk-header__link govuk-header__link--service-name">
                Naturalisation Tracker
              </Link>
              <nav>
                <ul className="govuk-list">
                  <li>
                    <Link href="/" className="govuk-link">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/submit" className="govuk-link">
                      Submit
                    </Link>
                  </li>
                  <li>
                    <Link href="/data" className="govuk-link">
                      Data explorer
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="govuk-link">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/admin" className="govuk-link">
                      Admin
                    </Link>
                  </li>
                </ul>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
