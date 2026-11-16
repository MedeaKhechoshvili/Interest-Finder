import { createBrowserRouter, RouterProvider } from "react-router-dom";

// Foundation only: no Home or other feature pages are implemented yet.
// Add the shared layout and feature routes here as their PRs are integrated.
const router = createBrowserRouter([
	{ path: "/", element: null },
	{ path: "*", element: null },
]);

export default function App() {
	return <RouterProvider router={router} />;
}
