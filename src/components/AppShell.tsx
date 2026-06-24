import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Newspaper,
  CalendarDays,
  BookOpen,
  Wand2,
  Search,
  Users,
  Menu,
  LogOut,
  Images,
  Mic,
  FileDown,
} from "lucide-react";
import pdfAsset from "@/assets/HappyBeez-Social-Studio.pdf.asset.json";
import pptxAsset from "@/assets/HappyBeez-Social-Studio.pptx.asset.json";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/nieuws", label: "Nieuws", icon: Newspaper },
  { path: "/kalender", label: "Kalender", icon: CalendarDays },
  { path: "/boek", label: "Boekbibliotheek", icon: BookOpen },
  { path: "/foto-bibliotheek", label: "Foto's & Kennisbank", icon: Images },
  { path: "/content-studio", label: "Content Studio", icon: Wand2 },
  { path: "/social-profielen", label: "Social Profielen", icon: Users },
  { path: "/seo", label: "SEO & Ranking", icon: Search },
  { path: "/agent", label: "Josef (AI)", icon: Mic },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-60 z-30 flex flex-col transition-transform duration-300",
          "bg-sidebar border-r border-sidebar-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:relative",
        )}
      >
        <div className="px-6 py-7 border-b border-sidebar-border">
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Social Studio
          </span>
          <h1 className="font-heading font-bold text-ink text-xl leading-tight mt-1">
            HappyBeez
          </h1>
          <div className="mt-3 h-px bg-gold/40 w-8" />
        </div>

        <nav className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
                <Link
                  key={path}
                  to={path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-all duration-150 border-l-2 pl-[10px]",
                  active
                    ? "bg-wine/10 text-wine font-semibold border-wine"
                    : "text-foreground/60 hover:bg-muted hover:text-foreground font-medium border-transparent",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    active ? "text-wine" : "text-muted-foreground",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
          <div className="px-3 pb-1">
            <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-semibold">
              Klantpresentatie
            </p>
            <div className="mt-1 flex flex-col gap-0.5">
              <a
                href={pdfAsset.url}
                download="HappyBeez-Social-Studio.pdf"
                className="flex items-center gap-2 text-xs text-foreground/70 hover:text-wine transition-colors"
              >
                <FileDown className="w-3 h-3" /> PDF downloaden
              </a>
              <a
                href={pptxAsset.url}
                download="HappyBeez-Social-Studio.pptx"
                className="flex items-center gap-2 text-xs text-foreground/50 hover:text-wine transition-colors"
              >
                <FileDown className="w-3 h-3" /> PowerPoint (.pptx)
              </a>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Uitloggen
          </button>
          <div className="mt-3 px-3">
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-border sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <span className="font-heading font-bold text-ink text-base">
            HappyBeez
          </span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
