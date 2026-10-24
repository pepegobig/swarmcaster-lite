import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout, NotFound } from "./Layout.jsx";
import { HomePage } from "./HomePage.jsx";
import { SeatsPage } from "./SeatsPage.jsx";
import { SeatPage } from "./SeatPage.jsx";
import { AppsPage } from "./AppsPage.jsx";

// Hash routes (#/, #/seats, #/seat/912, #/apps): the site is a static IPFS export with no server rewrites.
const root = createRootRoute({ component: Layout, notFoundComponent: NotFound });
const home = createRoute({ getParentRoute: () => root, path: "/", component: HomePage });
const SORTS = ["accepted", "recent", "posts"];
const seats = createRoute({
  getParentRoute: () => root,
  path: "/seats",
  component: SeatsPage,
  validateSearch: (s) => (SORTS.includes(s.sort) ? { sort: s.sort } : {}),
});
const seat = createRoute({ getParentRoute: () => root, path: "/seat/$tokenId", component: SeatPage });
const apps = createRoute({ getParentRoute: () => root, path: "/apps", component: AppsPage });

export const router = createRouter({
  routeTree: root.addChildren([home, seats, seat, apps]),
  history: createHashHistory(),
  scrollRestoration: true,
});
