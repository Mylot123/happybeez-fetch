import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, CalendarDays, Newspaper } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — HappyBeez" },
      { name: "description", content: "Overzicht van je social-media activiteit." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const name =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "daar";

  const cards = [
    {
      icon: LayoutDashboard,
      title: "Welkom",
      body: `Fijn dat je er bent, ${name}. Dit is je Social Studio.`,
      to: "/content-studio",
    },
    {
      icon: CalendarDays,
      title: "Kalender",
      body: "Plan en publiceer je posts in één overzicht.",
      to: "/kalender",
    },
    {
      icon: BookOpen,
      title: "Boekbibliotheek",
      body: "Hergebruik citaten en hoofdstukken uit je boek.",
      to: "/boek",
    },
    {
      icon: Newspaper,
      title: "Nieuws",
      body: "Volg relevante nieuwsberichten om op in te haken.",
      to: "/nieuws",
    },
  ] as const;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Overzicht
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Dashboard
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ icon: Icon, title, body, to }) => (
          <Link
            key={title}
            to={to}
            className="bg-card border border-border rounded-lg p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md bg-wine/10 text-wine flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <h2 className="font-heading font-semibold text-ink text-lg">
                {title}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
