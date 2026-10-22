import "./fonts.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The index answers 503 while IMD is busy: retry those a few times, everything else once.
      retry: (count, err) => (err && (err.status === 503 || err.status === 0) ? count < 3 : count < 1),
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
