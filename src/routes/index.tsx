import { Link, createFileRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Newspaper,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SocialMotor" },
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

type Card = { icon: LucideIcon; title: string; body: string; to: string };

const cards: Card[] = [
  {
    icon: Sparkles,
    title: "Welkom",
    body: "Fijn dat je er bent. Dit is jouw Social Studio.",
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
];

type Today = { channel: string; time: string; title: string; state: string; ok?: boolean; sage?: boolean };

const todayItems: Today[] = [
  { channel: "IG", time: "12:00", title: "Carrousel: 5 lessen uit hoofdstuk 3", state: "Gepland ✓", ok: true },
  { channel: "LI", time: "08:30", title: "Artikel: waarom consistentie wint van talent", state: "Wacht op goedkeuring", sage: true },
  { channel: "FB", time: "19:00", title: "Weekvraag aan de community", state: "Concept" },
];

function Dashboard() {
  const { user } = useAuth();
  const name =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "daar";

  return (
    <div className="px-6 sm:px-12 py-10 max-w-[1180px] mx-auto">
      <div className="flex items-end justify-between gap-6 flex-wrap mb-7">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] uppercase text-[#9C9C94] mb-2.5">
            <LayoutDashboard className="w-3 h-3 text-signal" />
            Overzicht
          </div>
          <div className="flex items-center gap-3.5">
            <span className="w-1 h-8 bg-signal rounded-[3px]" />
            <h1 className="font-heading text-[32px] font-extrabold tracking-[-0.02em] text-ink">
              Dashboard, {name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-white border border-line rounded-full px-[18px] py-2 text-[12.5px] text-[#75766F] whitespace-nowrap">
          <span className="relative flex items-center gap-1.5">
            <span className="relative w-1.5 h-1.5 rounded-full bg-[#3DDC84]">
              <span className="absolute -inset-1 rounded-full border border-[#3DDC84]/60 animate-ping" />
            </span>
            <b className="text-ink font-bold">de Bijenspecialist</b> actief
          </span>
          <span className="text-line">·</span>
          <span><b className="text-ink font-bold">6</b> posts deze week</span>
          <span className="text-line">·</span>
          <span><b className="text-ink font-bold">3</b> wachten op goedkeuring</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {cards.map(({ icon: Icon, title, body, to }) => (
          <Link
            key={title}
            to={to}
            className="group relative bg-white border border-line rounded-[18px] p-6 overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-14px_rgba(18,21,28,0.18)] hover:border-[#DAD6CE]"
          >
            <span className="absolute top-0 inset-x-0 h-[3px] bg-signal/90" />
            <div className="flex items-start justify-between mb-3.5">
              <div className="w-[42px] h-[42px] rounded-[12px] bg-signal-soft text-signal-deep flex items-center justify-center">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <ArrowRight className="w-4 h-4 text-[#9C9C94] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </div>
            <h3 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-ink mb-1.5">
              {title}
            </h3>
            <p className="text-[13px] text-[#75766F] leading-[1.55]">{body}</p>
          </Link>
        ))}
      </div>

      <div className="bg-white border border-line rounded-[18px] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-[14.5px] font-bold text-ink">Vandaag op de planning</h2>
          <span className="text-[11.5px] text-[#9C9C94]">{todayItems.length} items</span>
        </div>
        <div className="divide-y divide-line-soft">
          {todayItems.map((it) => (
            <div key={it.title} className="flex items-center gap-3.5 py-3">
              <span
                className={`font-mono text-[10.5px] font-bold tracking-wide w-[34px] text-center rounded-md py-1 ${
                  it.sage ? "text-sage bg-sage-soft" : "text-signal-deep bg-signal-soft"
                }`}
              >
                {it.channel}
              </span>
              <span className="font-mono text-[11.5px] text-[#9C9C94] w-12">{it.time}</span>
              <span className="flex-1 text-[13px] font-semibold text-ink">{it.title}</span>
              <span className={`text-[11.5px] font-semibold ${it.ok ? "text-sage" : "text-[#9C9C94]"}`}>
                {it.state}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
