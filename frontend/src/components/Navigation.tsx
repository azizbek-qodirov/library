import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Navigation() {
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
          Oxus Kutubxonasi
        </Link>

        {/* Toggle button for mobile view */}
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navbarNav"
          aria-expanded={isMenuOpen}
          aria-label="Menyuni ochish yoki yopish"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

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
                Asosiy menyu
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
                Kategoriyalar
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
