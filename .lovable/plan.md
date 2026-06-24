## Doel

De volledige Buzzybee Social Suite overzetten van Base44 naar dit Lovable-project, met **alle 7 pagina's** en hun functies werkend, op TanStack Start + Tailwind v4 + Lovable Cloud. Login via e-mail/wachtwoord én Google.

## Aanpak in fases

Een grote-bang-conversie gaat onvermijdelijk breken. Daarom in 5 fases, elke fase eindigt met een werkende app die ik direct kan testen.

### Fase 1 — Fundering (deze plan-goedkeuring → 1 ronde)
- Lovable Cloud aanzetten (database + auth + storage).
- Tailwind v4 design tokens overnemen uit Buzzybee's `index.css` (forest-groen, honing-accenten, "bee" thema).
- Datamodel aanmaken in Cloud — tabellen met RLS (per gebruiker):
  - `profiles` (auto via trigger op signup)
  - `book_contents` (citaten/hoofdstukken)
  - `content_calendar_items` (geplande posts)
  - `news_items` (nieuwsartikelen)
  - `seo_keywords`
  - `social_profiles`
- Auth-pagina's: `/auth` (login + register tabs) en `/reset-password`. E-mail/wachtwoord + Google.
- `_authenticated/` layout-gate (managed). App-shell met sidebar-navigatie zoals in `Layout.jsx` van Buzzybee.
- Dashboard-pagina als plek-houder met echte tellingen uit Cloud.

### Fase 2 — Kernworkflow content (1 ronde)
- **Content Studio** (`/content-studio`): editor met react-quill, status (idee/bewerking/gepland/gepubliceerd), kanaal-keuze, opslaan in `content_calendar_items`.
- **Kalender** (`/kalender`): maand-view met posts, drag-and-drop voor herplannen (`@hello-pangea/dnd`), filters op kanaal/status.

### Fase 3 — Input-bronnen (1 ronde)
- **Boekbibliotheek** (`/boek`): CRUD voor citaten en hoofdstukken; knop "Maak post hiervan" → opent Content Studio met inhoud voorgevuld.
- **Nieuws** (`/nieuws`): nieuws-items lijst + `NewsToPostModal` om een artikel naar geplande post om te zetten.

### Fase 4 — Marketing-tools (1 ronde)
- **SEO** (`/seo`): keywords beheren, SEO-resultaten renderen (`SEOResultRenderer`).
- **Social Profielen** (`/social-profielen`): accounts/handles per kanaal beheren.

### Fase 5 — Dashboard finaal + polish (1 ronde)
- Dashboard met echte statistieken (komende posts, recente content, keyword-overzicht).
- 404-pagina, error-boundaries, loading-states.
- Doorloop alle pagina's, fix kleine bugs.

## Wat niet meekomt (en waarom)

- **Base44 SDK** — vervangen door Lovable Cloud client.
- **react-router-dom** — vervangen door TanStack file-based routing.
- **Stripe** — niet meegenomen tenzij je dit echt nodig hebt (vraag ik in fase 4).
- **Three.js, Leaflet** — alleen meenemen als ik zie dat een pagina ze écht gebruikt; anders weglaten om de bundel klein te houden.
- **`base44/` map** — alleen als referentie gebruikt voor het datamodel, niet in de repo.

## Wat ik nodig heb van jou

Niets extra's nu. Na elke fase laat ik weten wat klaar is en wat te testen. Als iets net anders moet (kleur, label, gedrag), zeg het dan en pas ik het aan vóór de volgende fase.

## Technisch (voor de logs)

- Stack: TanStack Start v1, React 19, Vite 7, Tailwind v4 (CSS-first via `src/styles.css`, geen `tailwind.config.js`), shadcn-ui (al aanwezig).
- Cloud-clients per regel: browser-client in componenten, `requireSupabaseAuth` server-fns voor user-data, `supabaseAdmin` alleen voor privileged/seed.
- Routes onder `src/routes/_authenticated/` voor app-pagina's; `/auth` en `/reset-password` blijven publiek.
- Google login via `lovable.auth.signInWithOAuth("google", ...)` + `supabase--configure_social_auth`.
- Alle `.jsx` wordt herschreven naar `.tsx` met strict types.
- Pagina-data via TanStack Query (`ensureQueryData` in loader + `useSuspenseQuery` in component).

Akkoord? Dan start ik direct met Fase 1.