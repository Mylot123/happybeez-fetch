## Doel
Een nieuwe "Ranked keywords"-weergave op de SEO-pagina die toont voor welke zoekwoorden happybeez.nl al in Google rankt, op welke positie, met welk volume en welke URL — plus historie zodat je verschuivingen ziet.

## Data
Semrush endpoint `domains/domain_organic` (database `nl`). Kolommen: `Ph` (keyword), `Po` (positie), `Pp` (vorige positie), `Nq` (volume), `Cp` (CPC), `Co` (competition), `Ur` (rankende URL), `Td` (trend). Limiet 50 rijen per refresh om quota te sparen.

## Opslag
Hergebruik bestaande `seo_keyword_history` tabel — zelfde shape (keyword, rank, search_volume, cpc, position_url, checked_at). Elke refresh schrijft snapshots zodat we trends per keyword kunnen tekenen.

## Backend
Nieuwe server function `fetchRankedKeywords` in `src/lib/seo.functions.ts`:
- Roep Semrush `domain_organic` aan via connector gateway
- Parse kolommen → array
- Bulk insert in `seo_keyword_history`
- Bij quota-error (134): graceful fallback met laatste snapshot uit DB
- Retourneer huidige rijen + per-keyword vorige positie (Δ)

## UI (`src/routes/seo.tsx`)
Nieuw tabblad/sectie "Waar rankt happybeez.nl?":
- Knop "Vernieuw ranglijst" (toont quota-waarschuwing als geldt)
- Tabel: keyword | positie | Δ vs vorige meting | volume | CPC | URL | mini-trend (sparkline uit history)
- Filters: positie 1-3 / 4-10 / 11-20 / 21+ ("quick wins" filter = 4-20 met volume ≥ 50)
- Sortering op kolommen
- "Voeg toe aan content-studio" knop per rij → pre-fill keyword in `/content-studio`
- Empty state met uitleg als nog niets opgehaald

## Niet in scope
DataForSEO, PSI/Core Web Vitals, eigen crawler, content-gap module. Kunnen later als losse uitbreiding.
