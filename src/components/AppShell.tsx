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
  Palette,
  Sparkles,
  KanbanSquare,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import pdfAsset from "@/assets/HappyBeez-Social-Studio.pdf.asset.json";
import pptxAsset from "@/assets/HappyBeez-Social-Studio.pptx.asset.json";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { OrgSwitcher } from "@/components/OrgSwitcher";

type NavItem = { path: string; label: string; icon: LucideIcon; ai?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Overzicht",
    items: [{ path: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Strategie",
    items: [
      { path: "/merkprofiel", label: "Merkprofiel", icon: Palette },
      { path: "/campagnes", label: "Campagnes", icon: Sparkles },
    ],
  },
  {
    label: "Content",
    items: [
      { path: "/content-studio", label: "Content Studio", icon: Wand2 },
      { path: "/planning", label: "Planning & Approvals", icon: KanbanSquare },
      { path: "/kalender", label: "Kalender", icon: CalendarDays },
      { path: "/foto-bibliotheek", label: "Foto's & Kennis", icon: Images },
      { path: "/boek", label: "Boekbibliotheek", icon: BookOpen },
      { path: "/nieuws", label: "Nieuws", icon: Newspaper },
    ],
  },
  {
    label: "Groei",
    items: [
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
      { path: "/seo", label: "SEO & Ranking", icon: Search },
      { path: "/social-profielen", label: "Social Profielen", icon: Users },
      { path: "/agent", label: "De Bijenspecialist (AI)", icon: Mic, ai: true },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div
      className="min-h-screen flex text-[color:var(--color-text,#1A1D24)]"
      style={{
        background:
          "radial-gradient(circle at 1px 1px, rgba(18,21,28,0.05) 1px, transparent 0) 0 0/24px 24px, var(--paper)",
      }}
    >
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-[266px] z-30 flex flex-col transition-transform duration-300",
          "bg-ink-shell text-white px-4 pt-5 pb-4",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0 lg:relative",
        )}
      >
        <div className="flex items-center gap-2 px-2 pb-5">
          <Sparkles className="w-4 h-4 text-signal" />
          <span className="font-extrabold text-[14.5px] tracking-[0.06em] text-white">
            SOCIALMOTOR
          </span>
        </div>

        <div className="mb-5">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 overflow-y-auto pr-0.5 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-2 text-[10px] font-bold tracking-[0.12em] uppercase text-white/40">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ path, label, icon: Icon, ai }) => {
                  const active = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                        active
                          ? "bg-signal text-white"
                          : ai
                            ? "text-[#C9BEF2] hover:bg-white/5 hover:text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 flex-shrink-0",
                          ai && !active ? "text-signal" : "",
                        )}
                      />
                      <span className="truncate">{label}</span>
                      {ai && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-signal animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-3.5 mt-2">
          <p className="px-2.5 pb-2 text-[10px] font-bold tracking-[0.1em] uppercase text-white/40">
            Klantpresentatie
          </p>
          <a
            href={pdfAsset.url}
            download="HappyBeez-Social-Studio.pdf"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] text-white/60 hover:bg-white/5 hover:text-white"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF downloaden
          </a>
          <a
            href={pptxAsset.url}
            download="HappyBeez-Social-Studio.pptx"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] text-white/60 hover:bg-white/5 hover:text-white"
          >
            <FileDown className="w-3.5 h-3.5" /> PowerPoint (.pptx)
          </a>
          <button
            onClick={handleSignOut}
            className="w-full mt-1.5 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12.5px] text-white/50 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" /> Uitloggen
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-ink-shell text-white sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-extrabold tracking-[0.06em] text-sm">SOCIALMOTOR</span>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
