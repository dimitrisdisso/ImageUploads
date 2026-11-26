import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/site";
import { categories } from "@/lib/content";

export const Route = createFileRoute("/nea")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, categories.nea.name, settings['category_nea_description']); return result; },
  component: () => <CategoryPage slug="nea" />,
});
