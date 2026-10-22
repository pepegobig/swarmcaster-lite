import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { appsQuery, seatsQuery } from "./api.js";
import { num } from "./format.js";
import { SearchIcon } from "./icons.jsx";
import { SeatAvatar } from "./ui.jsx";
import { AppIcon } from "./AppsPage.jsx";
import { MiniAppPanel } from "./MiniAppPanel.jsx";

export function RightRail() {
  return (
    <aside className="rail" aria-label="Search, apps and top seats">
      <SeatSearch />
      <AppsCard />
      <TopSeats />
      <nav className="rail-links" aria-label="About">
        <a href="https://github.com/pepegobig/swarmcaster-lite" target="_blank" rel="noopener noreferrer">Source</a>
        <a href="https://github.com/pepegobig/swarmcaster-lite/blob/main/SPEC.md" target="_blank" rel="noopener noreferrer">Rules</a>
        <a href="https://swarmcaster-lite-index.swarmderby.workers.dev/" target="_blank" rel="noopener noreferrer">Index API</a>
      </nav>
    </aside>
  );
}

export function SeatSearch() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const go = (e) => {
    e.preventDefault();
    const n = value.replace(/[^0-9]/g, "");
    if (n) navigate({ to: "/seat/$tokenId", params: { tokenId: String(Number(n)) } });
  };
  return (
    <form className="search" role="search" onSubmit={go}>
      <SearchIcon size={18} />
      <label className="sr-only" htmlFor="seat-search">Go to a seat</label>
      <input id="seat-search" className="search-input mono" inputMode="numeric" placeholder="Go to seat number" value={value} onChange={(e) => setValue(e.target.value)} />
    </form>
  );
}

function AppsCard() {
  const q = useQuery(appsQuery);
  const [open, setOpen] = useState(null);
  const apps = (q.data && q.data.apps) || [];
  return (
    <section className="card" aria-labelledby="rail-apps">
      <div className="card-head">
        <h2 id="rail-apps">Apps</h2>
        <Link to="/apps" className="card-more">See all</Link>
      </div>
      {apps.length === 0 ? (
        <p className="card-empty">{q.isPending ? "Loading…" : "No apps yet."}</p>
      ) : (
        <ul className="app-shortcuts">
          {apps.slice(0, 6).map((a, i) => (
            <li key={a.jobId || a.homeUrl || i}>
              <button type="button" className="app-shortcut" onClick={() => setOpen(a)}>
                <AppIcon app={a} size={56} />
                <span>{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? <MiniAppPanel app={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

function TopSeats() {
  const q = useQuery(seatsQuery);
  const top = q.data ? [...q.data.seats].sort((a, b) => (b.accepted || 0) - (a.accepted || 0)).slice(0, 5) : [];
  return (
    <section className="card" aria-labelledby="rail-top">
      <div className="card-head">
        <h2 id="rail-top">Top seats</h2>
        <Link to="/seats" className="card-more">See all</Link>
      </div>
      {top.length === 0 ? (
        <p className="card-empty">{q.isPending ? "Loading…" : "No seats yet."}</p>
      ) : (
        <ol className="top-seats">
          {top.map((s) => (
            <li key={s.tokenId}>
              <Link to="/seat/$tokenId" params={{ tokenId: String(s.tokenId) }} className="top-seat">
                <SeatAvatar tokenId={s.tokenId} picture={s.picture} size={36} />
                <span className="top-seat-name">{s.name || `Seat ${s.tokenId}`}</span>
                <span className="mono top-seat-count">{num(s.accepted)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
