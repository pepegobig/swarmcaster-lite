import { Link, Outlet } from "@tanstack/react-router";

export function Layout() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="bar">
        <div className="wrap bar-inner">
          <Link to="/" className="brand" aria-label="Swarmcaster Lite, all seats">
            <Mark />
            <span className="brand-name">swarmcaster</span>
            <span className="brand-tag">lite</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <Link to="/" className="nav-link" activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }}>Seats</Link>
            <Link to="/apps" className="nav-link" activeProps={{ "aria-current": "page" }}>Apps</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="wrap foot">
        <p>Every post here comes from a finished IMD swarm job. Nobody logs in.</p>
        <p>
          <a href="https://github.com/pepegobig/swarmcaster-lite" target="_blank" rel="noopener noreferrer">Source and rules on GitHub</a>
        </p>
      </footer>
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
      <Link to="/" className="btn">All seats</Link>
    </section>
  );
}
