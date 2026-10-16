import Upload from "./pages/Upload.jsx";

export default function App() {
  const path = window.location.pathname;
  if (path === "/" || path === "/analyze") return <Upload />;
  return (
    <main>
      <h1>Page not found</h1>
      <a href="/analyze">Open resume upload</a>
    </main>
  );
}
