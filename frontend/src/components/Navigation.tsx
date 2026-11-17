import { useI18n } from '../../../shared/i18n';
import { LanguageSelect } from '../../../shared/LanguageSelect';
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Navigation() {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const handleNavClick = useCallback(() => {
    setIsMenuOpen(false); // close menu after click
  }, []);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (navRef.current && !navRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen, handleClickOutside]);

  return (
    <nav
      ref={navRef}
      className="navbar navbar-expand-lg navbar-light fixed-top"
    >
      <div className="container">
        {/* Brand */}
        <Link
          to="/"
          className="navbar-brand fw-bold text-decoration-none"
          onClick={handleNavClick}
        >
          {t("Oxus Library")}
        </Link>

        {/* Nav links */}
        <div
          className={`collapse navbar-collapse ${isMenuOpen ? "show" : ""}`}
          id="navbarNav"
        >
          <ul className="navbar-nav mx-auto">
            <li className="nav-item">
              <Link
                to="/"
                aria-current={location.pathname === "/" ? "page" : undefined}
                className={`nav-link fw-semibold text-decoration-none ${
                  location.pathname === "/" ? "active" : ""
                }`}
                onClick={handleNavClick}
              >
                {t("Home")}
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/categories"
                aria-current={location.pathname === "/categories" ? "page" : undefined}
                className={`nav-link fw-semibold text-decoration-none ${
                  location.pathname === "/categories" ? "active" : ""
                }`}
                onClick={handleNavClick}
              >
                {t("Categories")}
              </Link>
            </li>
          </ul>
        </div>
        <div className="public-nav-actions">
          <LanguageSelect />
          {/* Toggle button for mobile view */}
          <button
            className="navbar-toggler"
            type="button"
            aria-controls="navbarNav"
            aria-expanded={isMenuOpen}
            aria-label={t("Toggle navigation")}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
