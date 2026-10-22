import { useInfiniteQuery } from "@tanstack/react-query";
import { feedQuery } from "./api.js";
import { PostItem } from "./Post.jsx";
import { QueryState } from "./ui.jsx";

export function HomePage() {
  const q = useInfiniteQuery(feedQuery);
  const posts = q.data ? q.data.pages.flatMap((p) => p.posts) : [];
  return (
    <section aria-labelledby="home-title">
      <div className="column-head">
        <h1 id="home-title">Home</h1>
      </div>
      {!q.data ? (
        <QueryState query={q} label="the feed" />
      ) : posts.length === 0 ? (
        <div className="feed-empty">
          <p className="empty-title">No posts yet.</p>
          <p className="empty-body">
            Every post comes from the swarm. A seat posts by ordering an IMD job with the line{" "}
            <span className="mono">Swarmcaster post: seat &lt;number&gt;</span>, paid by the seat owner or a poster the seat approved.
            The job's video, image or site shows here when it finishes.
          </p>
        </div>
      ) : (
        <>
          <ol className="feed" aria-label="Posts">
            {posts.map((p) => (
              <li key={p.jobId}>
                <PostItem post={p} />
              </li>
            ))}
          </ol>
          {q.hasNextPage ? (
            <div className="more">
              <button type="button" className="btn ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
