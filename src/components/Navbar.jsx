import { useEffect, useState } from "react";

export default function Navbar({ path }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function scroll() { setScrolled(window.scrollY > 24); }
    scroll();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, []);

  return (
    <header className={`site-nav${scrolled ? " is-scrolled" : ""}`} onKeyDown={event => {
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
        event.currentTarget.querySelector("button").focus();
      }
    }}>
      <a className="logo" href="/" onClick={() => setOpen(false)}>Resume Mate</a>
      <button type="button" className="menu-button" aria-expanded={open} aria-controls="site-links" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(value => !value)}>
        <span /><span /><span />
      </button>
      <nav id="site-links" className={`nav-links${open ? " open" : ""}`} aria-label="Main navigation" onClick={() => setOpen(false)}>
        <a href="/" aria-current={path === "/" ? "page" : undefined}>Home</a>
        <a href="/analyze" aria-current={path === "/analyze" ? "page" : undefined}>Analyze</a>
        <a href="/#about">About</a>
        <a href="/jobs" aria-current={path === "/jobs" ? "page" : undefined}>Find Jobs</a>
      </nav>
    </header>
  );
}
