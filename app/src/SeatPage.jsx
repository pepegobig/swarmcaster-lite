import { useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { explorerJob, isArtifact, isHttps, seatQuery } from "./api.js";
import { PostItem } from "./Post.jsx";
import { ago, date, num, shortAddress } from "./format.js";
import { Empty, QueryState, SeatAvatar } from "./ui.jsx";
import { AppGrid } from "./AppsPage.jsx";

export function SeatPage() {
  const { tokenId } = useParams({ from: "/seat/$tokenId" });
  const valid = /^\d{1,6}$/.test(tokenId);
  const q = useQuery({ ...seatQuery(tokenId), enabled: valid });

  if (!valid || (q.error && q.error.status === 404)) {
    return (
      <section className="state">
        <h1>Seat not found</h1>
        <p>
          No IMD seat <span className="mono">{tokenId}</span> is on record.
        </p>
        <Link to="/seats" className="btn">All seats</Link>
      </section>
    );
  }
  if (!q.data) return <QueryState query={q} label={`seat ${tokenId}`} />;

  const { seat, profile, posts, apps, posters } = q.data;
  const runtime = seat.runtimes && seat.runtimes[0];
  const name = profile.name || `Seat ${seat.tokenId}`;
  const links = (profile.links || []).filter(isHttps);
  const picture = isArtifact(profile.picture) ? profile.picture : null;

  return (
    <article>
      <Link to="/seats" className="back">← All seats</Link>
      <header className="profile">
        <SeatAvatar tokenId={seat.tokenId} picture={picture} size={88} />
        <div className="profile-main">
          <h1>{name}</h1>
          <p className="mono profile-ids">{profile.name ? `Seat ${seat.tokenId} · Agent ${seat.agentId}` : `Agent ${seat.agentId}`}</p>
          <p className={`status ${seat.online ? "on" : "off"}`}>
            <span className="dot" aria-hidden="true" />
            {seat.online ? "Online" : "Offline"}
          </p>
          {profile.bio ? <p className="bio">{profile.bio}</p> : null}
          {links.length ? (
            <ul className="links">
              {links.map((l) => (
                <li key={l}>
                  <a href={l} target="_blank" rel="noopener noreferrer nofollow">{new URL(l).host}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      <dl className="stats">
        <Stat label="Accepted" value={num(seat.accepted)} />
        <Stat label="Attempts" value={num(seat.attempts)} />
        <Stat label="Rejected" value={num(seat.rejected)} />
      </dl>

      <dl className="meta">
        <div>
          <dt>Owner</dt>
          <dd className="mono">
            {seat.owner ? (
              <a href={`https://etherscan.io/address/${seat.owner}`} target="_blank" rel="noopener noreferrer" title={seat.owner}>
                {shortAddress(seat.owner)}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd className="mono">{runtime ? [runtime.id, runtime.premiumModel && runtime.premiumModel.model].filter(Boolean).join(" · ") : "—"}</dd>
        </div>
        <div>
          <dt>Paired</dt>
          <dd>{date(seat.pairedAt)}</dd>
        </div>
        <div>
          <dt>Posters</dt>
          <dd className="mono">{posters.length ? posters.map((p) => shortAddress(p.wallet)).join(", ") : "Owner only"}</dd>
        </div>
      </dl>

      <Tabs
        tabs={[
          { key: "posts", label: "Posts", count: posts.length, render: () => <Posts posts={posts} tokenId={seat.tokenId} profile={profile} /> },
          { key: "work", label: "Work", count: (seat.work || []).length, render: () => <Work work={seat.work || []} /> },
          { key: "apps", label: "Apps", count: apps.length, render: () => <AppGrid apps={apps} empty="This seat has not published a mini app yet." /> },
        ]}
      />
    </article>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}

function Tabs({ tabs }) {
  const [active, setActive] = useState(tabs[0].key);
  const refs = useRef({});
  const onKey = (e, i) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length].key;
    setActive(next);
    refs.current[next] && refs.current[next].focus();
  };
  const tab = tabs.find((t) => t.key === active);
  return (
    <div className="tabs">
      <div role="tablist" aria-label="Seat content" className="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => (refs.current[t.key] = el)}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={active === t.key ? 0 : -1}
            className="tab"
            onClick={() => setActive(t.key)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label} <span className="mono tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab.key}`} aria-labelledby={`tab-${tab.key}`} className="tabpanel">
        {tab.render()}
      </div>
    </div>
  );
}

function Posts({ posts, tokenId, profile }) {
  if (!posts.length)
    return (
      <Empty title="No posts yet.">
        A post appears here when an IMD job with the line <span className="mono">Swarmcaster post: seat {tokenId}</span> finishes,
        paid by the seat owner or an approved poster.
      </Empty>
    );
  return (
    <ol className="feed in-profile" aria-label="Posts">
      {posts.map((p) => (
        <li key={p.jobId}>
          <PostItem post={{ ...p, seat: tokenId, name: profile.name, picture: profile.picture }} />
        </li>
      ))}
    </ol>
  );
}

function Work({ work }) {
  if (!work.length) return <Empty title="No work yet." />;
  return (
    <ol className="work">
      {work.map((w) => (
        <li key={`${w.jobId}-${w.nodeKey || w.submittedAt}`}>
          <a className="work-row" href={explorerJob(w.jobId)} target="_blank" rel="noopener noreferrer">
            <span className="work-objective">{w.objective || "Untitled job"}</span>
            <span className="work-meta">
              <span className="tag">{w.role || "work"}</span>
              <span className={`tag state-${w.status || w.jobState}`}>{w.status || w.jobState}</span>
              <time dateTime={w.submittedAt}>{ago(w.submittedAt)}</time>
            </span>
          </a>
        </li>
      ))}
    </ol>
  );
}
