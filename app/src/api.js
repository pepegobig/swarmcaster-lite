// The Swarmcaster Lite index (SPEC.md, "Index API"). The IMD API sends no CORS headers, so the page reads only the index.
export const INDEX_URL = "https://swarmcaster-lite-index.swarmderby.workers.dev";
const ARTIFACTS = "https://api.imd.fun/artifacts/";

export class ApiError extends Error {
  constructor(status, code) {
    super(code || `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function get(path) {
  let r;
  try {
    r = await fetch(INDEX_URL + path, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, body.error);
  return body;
}

export const seatsQuery = { queryKey: ["seats"], queryFn: () => get("/seats"), staleTime: 60_000 };
export const seatQuery = (tokenId) => ({ queryKey: ["seat", tokenId], queryFn: () => get(`/seats/${tokenId}`), staleTime: 30_000 });
export const appsQuery = { queryKey: ["apps"], queryFn: () => get("/apps"), staleTime: 60_000 };
export const feedQuery = {
  queryKey: ["feed"],
  queryFn: ({ pageParam }) => get(`/feed?limit=20${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ""}`),
  initialPageParam: null,
  getNextPageParam: (last) => last.next,
  staleTime: 30_000,
};

export const isHttps = (u) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};
export const isArtifact = (u) => typeof u === "string" && u.startsWith(ARTIFACTS);
export const explorerJob = (jobId) => `https://explorer.imd.fun/jobs/${encodeURIComponent(jobId)}`;
