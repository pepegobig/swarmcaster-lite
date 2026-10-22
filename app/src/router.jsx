import { createHashHistory, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { Layout, NotFound } from "./Layout.jsx";
import { SeatsPage } from "./SeatsPage.jsx";
import { SeatPage } from "./SeatPage.jsx";
import { AppsPage } from "./AppsPage.jsx";

// Hash routes (#/, #/seat/912, #/apps): the site is a static IPFS export with no server rewrites.
const root = createRootRoute({ component: Layout, notFoundComponent: NotFound });
const seats = createRoute({ getParentRoute: () => root, path: "/", component: SeatsPage });
const seat = createRoute({ getParentRoute: () => root, path: "/seat/$tokenId", component: SeatPage });
const apps = createRoute({ getParentRoute: () => root, path: "/apps", component: AppsPage });

export const router = createRouter({
  routeTree: root.addChildren([seats, seat, apps]),
  history: createHashHistory(),
  scrollRestoration: true,
});
