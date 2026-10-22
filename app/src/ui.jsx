import { useMemo } from "react";

// A 5x5 mirrored pattern from the seat number: every seat gets the same avatar everywhere.
export function SeatAvatar({ tokenId, size = 40, picture }) {
  if (picture) return <img className="avatar" src={picture} width={size} height={size} alt="" loading="lazy" />;
  return <Pattern seed={Number(tokenId) || 0} size={size} />;
}

function Pattern({ seed, size }) {
  const cells = useMemo(() => {
    let x = (seed * 2654435761) >>> 0 || 1;
    const next = () => ((x ^= x << 13), (x ^= x >>> 17), (x ^= x << 5), (x >>> 0) / 4294967296);
    const out = [];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) {
        const v = next();
        if (v < 0.5) continue;
        const o = v > 0.82 ? 1 : 0.55;
        out.push([c, r, o]);
        if (c < 2) out.push([4 - c, r, o]);
      }
    return out;
  }, [seed]);
  return (
    <svg className="avatar pattern" width={size} height={size} viewBox="0 0 7 7" aria-hidden="true">
      <rect width="7" height="7" rx="1.2" className="pattern-bg" />
      {cells.map(([c, r, o], i) => (
        <rect key={i} x={c + 1} y={r + 1} width="1" height="1" className="pattern-cell" opacity={o} />
      ))}
    </svg>
  );
}

export function QueryState({ query, label }) {
  if (query.isPending)
    return (
      <div className="state" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Loading {label}…</p>
      </div>
    );
  const busy = query.error && (query.error.status === 503 || query.error.status === 0);
  return (
    <div className="state" role="alert">
      <h2>{busy ? "The swarm is busy" : `Could not load ${label}`}</h2>
      <p>{busy ? "IMD is answering slowly right now. Try again in a moment." : "Something went wrong while reading the index."}</p>
      <button type="button" className="btn" onClick={() => query.refetch()} disabled={query.isFetching}>
        {query.isFetching ? "Trying…" : "Try again"}
      </button>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <p className="empty-body">{children}</p> : null}
    </div>
  );
}
