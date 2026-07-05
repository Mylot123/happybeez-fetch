# Integratieplan: Happy Beez → pilot-tenant van SocialMotor

Happy Beez behoudt zijn huidige functies (SEO, foto-bibliotheek, boek, nieuws, agent, content-studio, kalender) en wordt de eerste organisatie in een multi-tenant SocialMotor-platform. We laten de rank tracker die er nu staat gewoon werken en bouwen daaromheen het bouwplan uit — in fases zodat elke sprint werkend oplevert.

## Mapping: wat we al hebben vs wat het bouwplan vraagt

```text
Bouwplan-feature            Status in Happy Beez         Actie
--------------------------  ---------------------------  -----------------------------
Merkprofiel                 impliciet in agent-context   → expliciete wizard + tabel
Campagneplanner (maand)     ontbreekt                    → NIEUW (Sprint 2)
Ideeëngenerator             deels in content-studio      → uitbreiden met pijler/campagne
Post-editor per platform    content-studio single-text   → platform-tabs + previews
AI-afbeeldingen             image.functions.ts bestaat   → merkstijl-presets + formaten
Template-video              ontbreekt                    → Creatomate (Sprint 5)
Contentkalender             kalender.tsx bestaat         → drag-drop + statuskleuren
Auto-publish FB/IG/LI/YT    ontbreekt                    → Ayrshare (Sprint 4)
Approval-workflow           ontbreekt                    → status-enum + RLS (Sprint 3)
Analytics                   ontbreekt                    → Sprint 6
Multi-tenant + rollen       single-user                  → Sprint 1 fundament
```

## Sprintplan (6 sprints, elk 1 lever-moment)

### Sprint 1 — Multi-tenant fundament (grootste refactor, doen als eerste)
- Nieuwe tabellen: `organizations`, `organization_members` (met `role` enum: `agency_admin | org_admin | editor`), `brand_profiles` (1-op-1 met org: branche, doelgroep, tone, pijlers, kleuren, logo).
- Alle bestaande HB-tabellen (`library_photos`, `book_contents`, `news_items`, `content_calendar_items`, `seo_*`, `social_profiles`, `agent_conversations`) krijgen `org_id uuid not null` + RLS-policy `has_org_access(auth.uid(), org_id)` via security-definer functie.
- Migratiescript: seed één organization "Happy Beez", koppel bestaande rijen, huidige gebruiker wordt `org_admin`.
- UI: org-switcher in AppShell topbar (dropdown met orgs waar user lid van is). Persist via URL-param of user-preference.

### Sprint 2 — Merkprofiel-wizard + Campagneplanner
- 5-staps wizard voor `brand_profiles` (branche → doelgroep → tone → pijlers → visuals).
- Tabel `campaign_plans` (org_id, month, theme, status) + `campaign_blocks` (plan_id, name, pillar, week, hook).
- Server function `generateCampaignPlan` via Lovable AI Gateway (Gemini): input = brand_profile + NL-kalender + laatste analytics → output = maandthema + 3-4 campagneblokken.
- Route `/campagnes` met maandpicker, "Genereer maandplan"-knop, goedkeuren.

### Sprint 3 — Approval-workflow op posts
- Uitbreiding `content_calendar_items` (of nieuwe `posts`-tabel): `status` enum `draft | review | approved | scheduled | published | failed`, `platform` enum, `body`, `hashtags[]`, `media_ids[]`, `scheduled_at`, `campaign_block_id`.
- Status-transities RLS-afgedwongen: alleen `org_admin`/`agency_admin` mogen naar `approved`.
- Content-studio herzien: platform-tabs (FB/IG/LI/YT), karakter-tellers, live-preview per platform, "Naar review"/"Keur goed"-knoppen.

### Sprint 4 — Auto-publish via Ayrshare
- Ayrshare als publishing-layer (gehoste OAuth, wij bewaren geen tokens).
- Secret `AYRSHARE_API_KEY` via `add_secret`.
- Server routes onder `/api/public/hooks/` voor Ayrshare-webhooks (post-status).
- pg_cron elke 5 min → server route die `status='scheduled' AND scheduled_at <= now()` posts pakt en naar Ayrshare stuurt.
- Kalender toont statuskleuren + fouten met retry-knop.

### Sprint 5 — Videostudio (Creatomate) + AI-beeld in merkstijl
- Secret `CREATOMATE_API_KEY`.
- Tabel `video_templates` (agency-breed, geen org_id), `media_assets` (org_id, type, url, source).
- Server function `renderVideo` → Creatomate → webhook update `media_assets.url`.
- Image-generator uitbreiden met formaat-presets (1:1, 4:5, 9:16, 16:9) + merkstijl-prompt-prefix uit `brand_profiles`.

### Sprint 6 — Analytics + feedback-loop
- pg_cron daily → Ayrshare Analytics API → `post_metrics`-tabel.
- Dashboard-tab: bereik/engagement/beste tijden per kanaal.
- Analytics-samenvatting wordt context voor volgende `generateCampaignPlan`-call → het feedback-mechanisme uit het bouwplan.

## Technische keuzes (afgestemd op Happy Beez-stack)

- **AI**: Lovable AI Gateway (Gemini) i.p.v. Anthropic direct — geen extra secret, geen extra facturatie. Het bouwplan noemt Claude Haiku maar Gemini 3 Flash Preview kan hetzelfde voor onze schaal.
- **Publishing**: Ayrshare (zoals bouwplan) — bespaart ons OAuth-onderhoud voor 4 platforms.
- **Video**: Creatomate (zoals bouwplan) — Edge/Worker kan geen ffmpeg draaien, dus dit is niet-onderhandelbaar.
- **Beeld**: hergebruik bestaande `image.functions.ts` (Lovable AI image) i.p.v. fal.ai — één minder secret, tenzij we specifieke FLUX-controls nodig hebben.
- **Auth-gating**: alle nieuwe routes onder `_authenticated/` layout die er al staat.

## Wat NIET in dit plan zit (bewust)

- TikTok/Pinterest/X publishing (buiten scope v1 conform bouwplan).
- White-label domeinen (Should, later).
- Reactie-inbox (Could, later).
- Generatieve AI-video / Kling (Should, credit-premium, later).
- Betaalde DataForSEO/SerpAPI upgrades — de gratis SERP-scrape van vorige sprint blijft.

## Volgorde-argument

Sprint 1 (multi-tenant) is de enige echte "big bang" — alles daarna is additief en per sprint los te testen op Happy Beez zelf. Als je Sprint 1 goedkeurt lever ik de migratie + org-switcher + gemigreerde routes in één keer op, en dan gaan we sprint-voor-sprint verder.

## Vraag voor jou

Beginnen we met Sprint 1 (multi-tenant fundament), of wil je eerst een detail-plan zien voor één specifieke sprint (bv. Sprint 2 campagneplanner) omdat die het meest urgent voelt voor Happy Beez zelf?
