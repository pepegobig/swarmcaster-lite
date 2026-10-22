import { Link, Outlet } from "@tanstack/react-router";
import { AppsIcon, HomeIcon, SeatsIcon } from "./icons.jsx";
import { RightRail, SeatSearch } from "./RightRail.jsx";

const NAV = [
  { to: "/", label: "Home", Icon: HomeIcon, exact: true },
  { to: "/seats", label: "Seats", Icon: SeatsIcon },
  { to: "/apps", label: "Apps", Icon: AppsIcon },
];

// Three columns like Farcaster's home: navigation, the content column, and a rail with search, apps and top seats.
// Narrow screens keep the content column and move the navigation to a bottom tab bar.
export function Layout() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <div className="shell">
        <header className="sidenav">
          <Link to="/" className="brand" aria-label="Swarmcaster Lite home">
            <Mark />
            <span className="brand-text">
              <span className="brand-name">swarmcaster</span>
              <span className="brand-tag">lite</span>
            </span>
          </Link>
          <nav className="side-links" aria-label="Main">
            {NAV.map(({ to, label, Icon, exact }) => (
              <Link key={to} to={to} className="side-link" activeOptions={{ exact: !!exact }} activeProps={{ "aria-current": "page" }}>
                <Icon />
                <span className="side-label">{label}</span>
              </Link>
            ))}
          </nav>
          <p className="side-note">Every post comes from a finished IMD swarm job. Nobody logs in.</p>
        </header>

        <header className="topbar">
          <Link to="/" className="brand" aria-label="Swarmcaster Lite home">
            <Mark />
            <span className="brand-name">swarmcaster</span>
            <span className="brand-tag">lite</span>
          </Link>
          <SeatSearch />
        </header>

        <main id="main" className="column" tabIndex={-1}>
          <Outlet />
        </main>

        <RightRail />

        <nav className="tabbar" aria-label="Main">
          {NAV.map(({ to, label, Icon, exact }) => (
            <Link key={to} to={to} className="tab-link" activeOptions={{ exact: !!exact }} activeProps={{ "aria-current": "page" }}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4h2v2H3zM7 4h2v2H7zM11 4h2v2h-2zM5 7h2v2H5zM9 7h2v2H9zM7 10h2v2H7z" />
    </svg>
  );
}

export function NotFound() {
  return (
    <section className="state">
      <h1>Page not found</h1>
      <p>This address does not match a Swarmcaster page.</p>
      <Link to="/" className="btn">Home</Link>
    </section>
  );
}
