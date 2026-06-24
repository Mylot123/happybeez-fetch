## Doel

De bestaande `happybeez` repo (een social-tracking app, momenteel op Base44) overzetten naar dit Lovable-project, zodat we hier verder kunnen bouwen met two-way sync naar GitHub.

## Belangrijk om vooraf te weten

Lovable kan **geen bestaande GitHub-repo importeren** als startpunt. De koppeling werkt alleen door vanuit dit Lovable-project een **nieuwe** repo aan te maken. Daarna is sync wel twee kanten op.

Daarnaast: Base44 gebruikt een andere structuur en eigen SDK. Dit project draait op **TanStack Start + Vite + React 19 + Tailwind v4** met file-based routing in `src/routes/`. De code uit happybeez gaat dus niet 1-op-1 werken — pagina's, data-calls en auth moeten aangepast worden.

## Stappen

### 1. Dit project aan GitHub koppelen (doe jij)
- Klik linksonder op **+** → **GitHub** → **Connect project**.
- Autoriseer de Lovable GitHub App.
- Kies het account/organisatie waar de nieuwe repo moet komen.
- Lovable maakt een nieuwe repo aan (bijv. `happybeez-lovable`).

### 2. Code uit happybeez naar de nieuwe repo kopiëren (doe jij lokaal)
- Clone de nieuwe Lovable-repo lokaal.
- Kopieer uit `happybeez` alleen de **inhoudelijke** delen:
  - React-componenten (`src/components/...`)
  - Stijlen / assets (afbeeldingen, iconen)
  - Eventuele utility-functies die niet Base44-specifiek zijn
- **Niet** kopiëren: Base44 SDK-configuratie, routing-opzet, build-config, `package.json` van Base44 — die conflicteren met de Lovable-stack.
- Commit en push naar GitHub → synct automatisch naar dit Lovable-project.

### 3. Hier in Lovable de structuur omzetten (doe ik)
Zodra de bestanden binnen zijn:
- Pagina's omzetten naar TanStack Start route-bestanden in `src/routes/` (bijv. `feed.tsx`, `profile.tsx`).
- Base44 SDK-calls vervangen door Lovable Cloud (database, auth, storage).
- Data-modellen (posts, gebruikers, follows, etc.) opzetten in Lovable Cloud met de juiste RLS-policies.
- Login/auth opnieuw bedraden via Lovable Cloud auth.
- Styling controleren onder Tailwind v4 (kan kleine aanpassingen nodig hebben).

### 4. Verifiëren
- Routes laden zonder 404.
- Auth flow werkt (signup, login, logout).
- Data lezen/schrijven werkt.
- Two-way sync getest: een wijziging hier verschijnt in GitHub, en omgekeerd.

## Wat ik nog van je nodig heb

Om stap 3 goed te doen, deel na het koppelen graag:
- Welke pagina's/schermen happybeez heeft (bijv. feed, profiel, post-aanmaken).
- Welke data je opslaat (welke "tabellen" of entiteiten).
- Of er login is, en zo ja welke methode (email/wachtwoord, Google, etc.).

## Alternatief als stap 2 te omslachtig is

Als lokaal werken met git lastig is, kunnen we ook from scratch bouwen in Lovable op basis van een korte beschrijving + screenshots van happybeez. Dan slaan we de kopie-stap over en bouwen het hier direct in de juiste stack.
