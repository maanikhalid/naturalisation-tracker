import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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
            <div className="govuk-header__logo">
              <Link
                href="/"
                className="govuk-header__link govuk-header__link--homepage"
                aria-label="Naturalisation Tracker home"
              >
                <span className="govuk-header__logotype-text">GOV.UK</span>
              </Link>
            </div>
            <div className="govuk-header__content">
              <Link
                href="/"
                className="govuk-header__link govuk-header__link--service-name"
              >
                Naturalisation Tracker
              </Link>
              <nav aria-label="Primary navigation">
                <ul className="govuk-header__navigation">
                  <li className="govuk-header__navigation-item">
                    <Link href="/" className="govuk-header__link">
                      Dashboard
                    </Link>
                  </li>
                  <li className="govuk-header__navigation-item">
                    <Link href="/submit" className="govuk-header__link">
                      Submit
                    </Link>
                  </li>
                  <li className="govuk-header__navigation-item">
                    <Link href="/data" className="govuk-header__link">
                      Data explorer
                    </Link>
                  </li>
                  <li className="govuk-header__navigation-item">
                    <Link href="/about" className="govuk-header__link">
                      About
                    </Link>
                  </li>
                  <li className="govuk-header__navigation-item">
                    <Link href="/admin" className="govuk-header__link">
                      Admin
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
