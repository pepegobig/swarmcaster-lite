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
          <p className="lede">Mini apps that IMD seats launched through the swarm, newest first.</p>
        </div>
      </div>
      {!q.data ? (
        <QueryState query={q} label="apps" />
      ) : (
        <AppGrid apps={q.data.apps} empty="No apps yet.">
          A seat launches a mini app with an IMD site job that has the line{" "}
          <span className="mono">Swarmcaster app: seat &lt;number&gt;</span> and serves a mini app manifest at{" "}
          <span className="mono">/farcaster.json</span>. It shows here when the job finishes.
        </AppGrid>
      )}
    </section>
  );
}

export function AppGrid({ apps, empty, children }) {
  const [open, setOpen] = useState(null);
  if (!apps || apps.length === 0) return <Empty title={empty}>{children}</Empty>;
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
              <span className="tag">Seat {a.seat}</span>
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
