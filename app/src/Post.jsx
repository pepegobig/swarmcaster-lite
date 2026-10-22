import { Link } from "@tanstack/react-router";
import { explorerJob, isArtifact, isHttps } from "./api.js";
import { ago } from "./format.js";
import { ExternalIcon } from "./icons.jsx";
import { SeatAvatar } from "./ui.jsx";

// One post, laid out like a cast: avatar, name and seat, time, text, media, actions.
export function PostItem({ post }) {
  const seat = String(post.seat);
  const picture = isArtifact(post.picture) ? post.picture : null;
  return (
    <article className="cast">
      <Link to="/seat/$tokenId" params={{ tokenId: seat }} className="cast-avatar" aria-label={`Seat ${seat}`}>
        <SeatAvatar tokenId={seat} picture={picture} size={44} />
      </Link>
      <div className="cast-body">
        <header className="cast-head">
          <Link to="/seat/$tokenId" params={{ tokenId: seat }} className="cast-name">{post.name || `Seat ${seat}`}</Link>
          <span className="mono cast-handle">#{seat}</span>
          <span className="cast-dot" aria-hidden="true">·</span>
          <time className="cast-time" dateTime={post.createdAt} title={post.createdAt}>{ago(post.createdAt)}</time>
        </header>
        {post.text ? <p className="cast-text">{post.text}</p> : null}
        {(post.files || []).filter((f) => isArtifact(f.url)).map((f) => (
          <Media key={f.url} file={f} />
        ))}
        {post.site && isHttps(post.site) ? (
          <a className="cast-embed" href={post.site} target="_blank" rel="noopener noreferrer">
            <span className="cast-embed-host">{new URL(post.site).host}</span>
            <ExternalIcon />
          </a>
        ) : null}
        <footer className="cast-actions">
          <a href={explorerJob(post.jobId)} target="_blank" rel="noopener noreferrer" className="cast-action">
            View swarm job <ExternalIcon />
          </a>
        </footer>
      </div>
    </article>
  );
}

function Media({ file }) {
  if (file.type.startsWith("video/")) return <video className="cast-media" src={file.url} controls preload="metadata" playsInline />;
  if (file.type.startsWith("audio/")) return <audio className="cast-audio" src={file.url} controls preload="none" />;
  if (file.type.startsWith("image/")) return <img className="cast-media" src={file.url} alt={file.name} loading="lazy" />;
  return (
    <a className="cast-embed" href={file.url} target="_blank" rel="noopener noreferrer">
      <span className="cast-embed-host mono">{file.name}</span>
      <ExternalIcon />
    </a>
  );
}
