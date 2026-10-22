import { CATEGORIES, type CategoryId } from "./manifest.ts";

const SHORT: Record<CategoryId, string> = {
  "research-quant": "Quant research",
  "investment-underwriting": "Underwriting",
  "ai-automation": "AI & automation",
  "product-engineering": "Product",
};

const BASE: string = import.meta.env.BASE_URL;

/** Global navigation for the research pages: the same reading order everywhere. */
export function SiteNav({ current }: { current?: "city" | CategoryId }) {
  const item = (href: string, label: string, on: boolean, title?: string) => (
    <a key={href} href={href} aria-current={on ? "page" : undefined} title={title}>
      {label}
    </a>
  );
  const links = (
    <>
      {item(BASE, "Overview", false)}
      {item(`${BASE}research/#city`, "Research City", current === "city")}
      {(Object.keys(CATEGORIES) as CategoryId[]).map((c) => item(`${BASE}research/#work-${c}`, SHORT[c], current === c, CATEGORIES[c]))}
      {item(`${BASE}#experience`, "About", false, "About and experience")}
    </>
  );
  return (
    <header className="nav rc-nav">
      <a className="nav-id" href={BASE}>
        <span className="mono-mark" aria-hidden>
          SB
        </span>
        <span className="nav-name">
          Siddharth Bagga
          <em>Research operations</em>
        </span>
      </a>
      <nav className="nav-links rc-links" aria-label="Portfolio">
        {links}
      </nav>
      <details className="rc-menu">
        <summary>Menu</summary>
        <nav aria-label="Portfolio (menu)">
          {links}
          {item(`${BASE}Siddharth_Bagga_Resume.pdf`, "Résumé (PDF)", false)}
        </nav>
      </details>
      <div className="nav-cta">
        <a className="nav-btn rc-resume" href={`${BASE}Siddharth_Bagga_Resume.pdf`}>
          Résumé
        </a>
        <a className="nav-btn hot" href={`${BASE}#connect`}>
          Get in touch
        </a>
      </div>
    </header>
  );
}
