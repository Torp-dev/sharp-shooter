import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/game/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rooftop Sniper — Village Overwatch Shooter" },
      {
        name: "description",
        content:
          "Hold the rooftop, range hostiles across a broken village with 5X, 10X and 15X scopes, and survive escalating rounds. Playable on desktop and mobile.",
      },
      { property: "og:title", content: "Rooftop Sniper — Village Overwatch Shooter" },
      {
        property: "og:description",
        content:
          "A 3D sniper survival game: scope in, control your breath, and clear the village round after round.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
