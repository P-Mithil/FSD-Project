import Jobs from "./pages/Jobs.jsx";

export default function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/jobs") {
    return <Jobs />;
  }

  return (
    <main>
      <h1>Page not found</h1>
      <a href="/jobs">Go to Live Jobs</a>
    </main>
  );
}
