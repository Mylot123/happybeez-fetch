# De Bijenkenner: eigen pagina in de happybeez.nl-stijl

Een aparte, schone pagina met alleen de gespreksassistent, in exact de look and feel van happybeez.nl.

## Wat de bezoeker ziet

- Geen menu, geen zijbalk, geen inlog-elementen. Alleen de pagina zelf.
- Bovenaan links een terugknop ("Terug naar happybeez.nl").
- Titel "De Bijenkenner" met de korte uitleg eronder, in het diepe groen van de site.
- Twee manieren om te praten: een knop "Chatten" en een knop "Spraak". Chatten staat standaard aan, dus wie geen microfoon wil gebruiken kan meteen typen.
- Het gespreksvenster is een witte kaart met zachte ronde hoeken op een licht groene achtergrond, zoals de blokken op happybeez.nl.
- Antwoorden van de Bijenkenner worden netjes opgemaakt (alinea's, opsommingen, vetgedrukte labels).
- Geen gespreksgeschiedenis, geen lijst met eerdere gesprekken, geen samenvattingen. Alleen het gesprek van dit moment; bij het verversen van de pagina begint het opnieuw.

## Stijl (afgeleid van de screenshot)

- Diep groen voor koppen en tekst, donkergroen voor de balk bovenin.
- Zacht groengrijze paginaachtergrond, witte kaarten.
- Oranje accent alleen voor de belangrijkste actieknop (verzenden / start gesprek), zoals de "Naar de Webshop"-knop.
- Rustige, brede typografie zoals op de site; koppen halfvet, bodytekst licht.

## Technisch

- Pagina: bestaande publieke route `src/routes/embed.bijenkenner.tsx` wordt herschreven naar deze stijl (staat al buiten het beveiligde menu, dus geen navigatie zichtbaar).
- Terugknop: link naar `https://www.happybeez.nl`, plus fallback naar browser-terug wanneer de pagina in een iframe staat.
- Chat loopt via het bestaande publieke eindpunt `src/routes/api/public/bee-chat.ts` (ongewijzigd, inclusief de Happybeez-instructies en CORS).
- Spraak blijft via de ElevenLabs-agent met microfoontoestemming en duidelijke foutmelding als toestemming ontbreekt.
- Kleuren worden als lokale stijlwaarden in de pagina gezet zodat het widget ook los in WordPress dezelfde kleuren houdt.
- Berichten alleen in component-state; niets wordt opgeslagen of opgehaald uit de database.
- Eigen paginatitel en omschrijving; `noindex` blijft staan zolang de pagina als widget dient.

## Plaatsen op WordPress

De pagina blijft insluitbaar met een Custom HTML-blok:

```text
<iframe src="https://happy-beez-fetcher.lovable.app/embed/bijenkenner"
        style="width:100%;max-width:820px;height:680px;border:0;"
        allow="microphone; autoplay" loading="lazy"></iframe>
```
