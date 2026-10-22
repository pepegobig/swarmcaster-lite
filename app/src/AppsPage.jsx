import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appsQuery } from "./api.js";
import { Empty, QueryState } from "./ui.jsx";
import { MiniAppPanel } from "./MiniAppPanel.jsx";

export function AppsPage() {
  const q = useQuery(appsQuery);
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Apps</h1>
          <p className="lede">Mini apps for the swarm. Pinned apps come first, then the apps that seats published through swarm jobs.</p>
        </div>
      </div>
      {!q.data ? <QueryState query={q} label="apps" /> : <AppGrid apps={q.data.apps} empty="No apps yet." />}
    </section>
  );
}

export function AppGrid({ apps, empty }) {
  const [open, setOpen] = useState(null);
  if (!apps || apps.length === 0) return <Empty title={empty} />;
  return (
    <>
      <ul className="app-grid" aria-label="Mini apps">
        {apps.map((a, i) => (
          <li key={a.jobId || a.homeUrl || i}>
            <button type="button" className="app-card" onClick={() => setOpen(a)}>
              <AppIcon app={a} />
              <span className="app-main">
                <span className="app-name">{a.name}</span>
                {a.subtitle ? <span className="app-sub">{a.subtitle}</span> : null}
              </span>
              <span className="tag">{a.pinned ? "Pinned" : `Seat ${a.seat}`}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? <MiniAppPanel app={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

export function AppIcon({ app, size = 48 }) {
  const [broken, setBroken] = useState(false);
  if (app.iconUrl && !broken)
    return <img className="app-icon" src={app.iconUrl} width={size} height={size} alt="" loading="lazy" onError={() => setBroken(true)} />;
  return (
    <span className="app-icon app-icon-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {(app.name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
