# Instagram-mockup: tekst-overlay + carrousel

## Doel
De Instagram-preview in Content Studio moet eruitzien als een echt Instagram-bericht: tekst op de foto voor scroll-stopping power, en een werkende carrousel-preview als de AI slides heeft gegenereerd.

## Huidige situatie
- `PostMockups.tsx` toont alleen een foto + onderschrift; geen tekst-overlay.
- Content Studio genereert al wel een `CAROUSEL:`-blok met slide-titels, maar toont die alleen als tekstlijst, niet als visuele slides.
- De gebruiker wil dat een Instagram-post tekst in het beeld heeft.

## Aanpak

### 1. Tekst-overlay op single-image Instagram-mockup
- `PhoneMockup` krijgt een optionele `overlayText`-prop (titel/hook).
- Render de tekst over de foto heen met een subtiele donkere gradient onderaan voor leesbaarheid.
- Gebruik witte, vetgedrukte tekst, maximaal 2 regels, passend binnen de 1:1 preview.
- Content Studio stuurt `topic` of `suggestedTitle` mee als overlay-tekst.

### 2. Carrousel-preview in Instagram-mockup
- `PhoneMockup` krijgt een optionele `slides`-prop: array van `{ text: string }`.
- Toon pijltjes en dots; swipe/klik om tussen slides te wisselen.
- Elke slide toont dezelfde foto als achtergrond, maar met een andere tekst-overlay (de slide-titel).
- Als er geen slides zijn, valt terug naar de single-image weergave.

### 3. Content Studio koppeling
- Geef de gegenereerde carrousel-lijst (`carousel`) door aan de `PhoneMockup`.
- Gebruik `suggestedTitle` of de eerste regel van `generated` als fallback overlay-tekst.
- Behoud bestaande gedragingen: handmatige foto-selectie, upload, AI-beeldgeneratie en watermerk blijven werken.

### 4. Visuele afwerking
- Pas de tekst-overlay aan op de HappyBeez-stijl: rustig, leesbaar, niet schreeuwerig.
- Zorg dat de mockup nog steeds herkenbaar is als Instagram.

## Bestanden die aangepast worden
- `src/components/PostMockups.tsx`
- `src/routes/content-studio.tsx`

## Niet in scope
- Nieuwe AI-beeldgeneratie voor elke carrousel-slide; we hergebruiken het geselecteerde/behaalde beeld.
- Wijzigingen aan de caption-generator of contentstrategie.
- Aanpassingen aan andere kanalen dan Instagram.
