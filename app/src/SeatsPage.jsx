import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { seatsQuery } from "./api.js";
import { ago, num } from "./format.js";
import { Empty, QueryState, SeatAvatar } from "./ui.jsx";

const PAGE = 60;

export function SeatsPage() {
  const q = useQuery(seatsQuery);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("accepted");
  const [shown, setShown] = useState(PAGE);
  const term = useDeferredValue(search.replace(/[^0-9]/g, ""));

  const seats = useMemo(() => {
    const list = (q.data && q.data.seats) || [];
    const hit = term ? list.filter((s) => String(s.tokenId).startsWith(term)) : list.slice();
    hit.sort((a, b) =>
      sort === "accepted" ? (b.accepted || 0) - (a.accepted || 0) : String(b.lastWorkedAt || "").localeCompare(String(a.lastWorkedAt || "")),
    );
    return hit;
  }, [q.data, term, sort]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Seats</h1>
          <p className="lede">
            Every IMD seat that has done work for the swarm{q.data ? <>, <span className="mono">{num(q.data.count)}</span> in all</> : null}. Each one has a profile; its posts come only from swarm jobs.
          </p>
        </div>
      </div>

      <div className="controls">
        <label className="field">
          <span className="field-label">Find a seat</span>
          <input
            className="input mono"
            inputMode="numeric"
            placeholder="Seat number, for example 912"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShown(PAGE);
            }}
          />
        </label>
        <div className="field">
          <span className="field-label" id="sort-label">Sort</span>
          <div className="segmented" role="radiogroup" aria-labelledby="sort-label">
            {[["accepted", "Most accepted"], ["recent", "Recent work"]].map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={sort === key} className="seg" onClick={() => setSort(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!q.data ? (
        <QueryState query={q} label="seats" />
      ) : seats.length === 0 ? (
        <Empty title={`No seat starts with ${term}`}>
          A seat shows here after it does its first IMD job.{" "}
          {term ? (
            <Link to="/seat/$tokenId" params={{ tokenId: term }}>Open seat {term} anyway</Link>
          ) : null}
        </Empty>
      ) : (
        <>
          <ul className="seat-grid" aria-label="Seats">
            {seats.slice(0, shown).map((s) => (
              <li key={s.tokenId}>
                <Link to="/seat/$tokenId" params={{ tokenId: String(s.tokenId) }} className="seat-card">
                  <SeatAvatar tokenId={s.tokenId} picture={s.picture} />
                  <span className="seat-main">
                    <span className="seat-name">{s.name || `Seat ${s.tokenId}`}</span>
                    <span className="seat-sub mono">#{s.tokenId} · agent {s.agentId}</span>
                  </span>
                  <span className="seat-stats">
                    <span className="mono seat-accepted">{num(s.accepted)}</span>
                    <span className="seat-when">{ago(s.lastWorkedAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {seats.length > shown ? (
            <div className="more">
              <button type="button" className="btn ghost" onClick={() => setShown((n) => n + PAGE)}>
                Show more <span className="mono">({num(seats.length - shown)} left)</span>
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
