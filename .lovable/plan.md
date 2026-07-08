Huidige stand van zaken

De virale contentstrategie is al op drie plekken terug te vinden in het systeem:

1. Geheugen (memory)
   - `mem://features/viral-content-strategy.md` bevat het volledige speelboek per platform.
   - `mem://features/posting-schedule.md` bevat de beste tijden, dagen, frequentie en weekcadans.
   - `mem://index.md` noemt expliciet dat content volgens deze strategie wordt geproduceerd.

2. Kalender (`/kalender`)
   - Elke dag toont een suggestie uit `WEEKLY_PLAN` met kanaal, type, aanbevolen tijd en format (bijv. "Ma 12:30 · IG Reel 9:16").
   - Onder de kalender staat per kanaal het advies over beste tijden en dagen.

3. Content Studio (`/content-studio`)
   - De AI-prompt bevat platformspecifieke "playbooks" voor Instagram, Facebook en LinkedIn.
   - Die playbooks dwingen de juiste structuur af: hook-lengte, emoji-limiet, hashtag-limiet, CTA-stijl, toon en vermeden termen.
   - Blog valt terug op een neutrale instructie; daar zit nog geen volledig blog-playbook in.

Wat er nog beter kan

De strategie zit nu vooral in de achtergrond (prompts en geheugen). Voor de gebruiker is niet altijd zichtbaar waarom de AI iets bepaalds genereert. Dit plan maakt de strategie zichtbaarder tijdens het schrijven.

Te bouwen:

1. Strategiepaneel in Content Studio
   - Een inklapbaar paneel rechts van het tekstveld.
   - Toont per gekozen kanaal de belangrijkste regels uit het playbook:
     - ideale hook-lengte,
     - maximale woordenaantal,
     - aantal hashtags,
     - aanbevolen CTA,
     - beste format (Reel, carrousel, document, etc.).
   - Inhoud komt uit de bestaande geheugenbestanden, zodat het consistent blijft.

2. Live feedback op de gegenereerde tekst
   - Woordenteller met kleurindicatie (groen/oranje/rood) per kanaal.
   - Hashtag-teller (aantal # in de tekst).
   - Eenvoudige hook-check: waarschuwing als de eerste regel te lang is voor het gekozen kanaal.

3. Format- en tijdsadvies bij opslaan
   - Wanneer een post wordt opgeslagen in de kalender, toon een herinnering met het aanbevolen format en de beste posttijd voor dat kanaal.
   - Voorstel om de publicatietijd automatisch in te vullen op basis van `WEEKLY_PLAN` / posting-schedule.

4. Blog-playbook aanvullen
   - Toevoegen van een volledig blog-playbook aan de AI-prompt, gebaseerd op het geheugenbestand (people-first, SEO-structuur, interne links, CTA, distributie).

5. Watermerk-controle (reeds aanwezig, behouden)
   - AI-beelden en uploads krijgen automatisch het HappyBeez-watermerk; dit blijft ongewijzigd.

Technische details

- Wijzigingen beperken tot frontend: `src/routes/content-studio.tsx` en eventueel een nieuw helperbestand `src/lib/content-strategy.ts` voor de strategie-regels.
- Geen database-wijzigingen nodig.
- Bestaande server functions (`generateText`, `generatePostImage`, `uploadUserPhoto`) blijven ongewijzigd.
- Build-verificatie via `bun run build` na wijzigingen.

Acceptatiecriteria

- Content Studio toont een duidelijk strategiepaneel per kanaal.
- Gegenereerde tekst krijgt live feedback over lengte, hashtags en hook.
- Bij opslaan verschijnt format- en tijdsadvies.
- Blog-content volgt hetzelfde playbook als in de geheugenbestanden.
- Build slaagt zonder fouten.