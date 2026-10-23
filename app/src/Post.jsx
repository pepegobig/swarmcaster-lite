import { Link } from "@tanstack/react-router";
import { explorerJob, isArtifact, isHttps } from "./api.js";
import { ago } from "./format.js";
import { ExternalIcon } from "./icons.jsx";
import { SeatAvatar } from "./ui.jsx";

// One post, laid out like a cast: avatar, name and seat, time, text, media, actions.
export function PostItem({ post }) {
  const seat = String(post.seat);
  const picture = isArtifact(post.picture) ? post.picture : null;
  const files = (post.files || []).filter((f) => isArtifact(f.url));
  // A video job's "poster" image becomes the video's cover instead of a separate image.
  const hasVideo = files.some((f) => f.type.startsWith("video/"));
  const poster = hasVideo ? files.find((f) => f.type.startsWith("image/") && /poster|thumb|cover/i.test(f.name)) : null;
  const media = poster ? files.filter((f) => f !== poster) : files;
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
        {media.map((f) => (
          <Media key={f.url} file={f} poster={f.type.startsWith("video/") && poster ? poster.url : undefined} />
        ))}
        {post.link && isHttps(post.link) && post.link !== post.site ? <LinkCard url={post.link} /> : null}
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

// A post's "Swarmcaster link:" as a card: the host in bold, the path below, opening in a new tab.
function LinkCard({ url }) {
  const u = new URL(url);
  const path = (u.pathname + u.search).replace(/^\/$/, "");
  return (
    <a className="cast-link" href={url} target="_blank" rel="noopener noreferrer">
      <span className="cast-link-text">
        <span className="cast-link-host">{u.host}</span>
        {path ? <span className="cast-link-path mono">{path}</span> : null}
      </span>
      <ExternalIcon />
    </a>
  );
}

function Media({ file, poster }) {
  if (file.type.startsWith("video/")) return <video className="cast-media" src={file.url} poster={poster} controls preload="metadata" playsInline />;
  if (file.type.startsWith("audio/")) return <audio className="cast-audio" src={file.url} controls preload="none" />;
  if (file.type.startsWith("image/")) return <img className="cast-media" src={file.url} alt={file.name} loading="lazy" />;
  return (
    <a className="cast-embed" href={file.url} target="_blank" rel="noopener noreferrer">
      <span className="cast-embed-host mono">{file.name}</span>
      <ExternalIcon />
    </a>
  );
}
