import { companyHead, settingsFromMatches } from "@/lib/site-settings";
import { createFileRoute } from "@tanstack/react-router";
import { CategoryPage } from "@/components/site";
import { categories } from "@/lib/content";

export const Route = createFileRoute("/geitonia")({
  head: ({ matches }) => { const settings = settingsFromMatches(matches); const result = companyHead(matches, categories.geitonia.name, settings['category_geitonia_description']); return result; },
  component: () => <CategoryPage slug="geitonia" />,
});
