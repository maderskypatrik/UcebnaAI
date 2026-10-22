const NAV = [
  { label: "Přehled", href: "/", active: true },
  { label: "Nová příprava", href: "/", active: false },
  { label: "Kabinet", href: "/", active: false },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-10 bg-surface-container-low px-6 py-10 lg:flex">
      <div className="font-display text-title-lg font-bold text-primary-container">
        Učebna.ai
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={`rounded-xl px-4 py-3 text-body-lg transition-colors ${
              item.active
                ? "bg-surface-container-lowest font-medium text-primary-container shadow-ambient"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
