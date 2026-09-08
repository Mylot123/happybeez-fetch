import { createFileRoute } from "@tanstack/react-router";
import { EmbedBijenkenner } from "./embed.bijenkenner";

export const Route = createFileRoute("/bijenkenner")({
  component: EmbedBijenkenner,
  head: () => ({
    meta: [
      { title: "De Bijenkenner van Happybeez | Stel je vraag over wilde bijen" },
      {
        name: "description",
        content:
          "Stel je vraag over wilde bijen, bijenhotels en biodiversiteit aan de Bijenkenner van Happybeez. Chat of praat direct met de online bijenexpert.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "De Bijenkenner van Happybeez" },
      {
        property: "og:description",
        content: "Chat of praat met de online bijenexpert van Happybeez over wilde bijen en bijenhotels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
