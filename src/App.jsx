import JobsResume from "./components/JobsResume.jsx";

export default function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/jobs") {
    return <JobsResume />;
  }

  return (
    <main>
      <h1>Page not found</h1>
      <a href="/jobs">Go to Live Jobs</a>
    </main>
  );
}
