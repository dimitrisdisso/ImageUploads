import { createFileRoute, notFound } from '@tanstack/react-router';
import { publicContent } from '@/lib/cms.functions';
import { CategoryPage } from '@/components/site';
import { companyHead } from '@/lib/site-settings';
import { publicationCategories } from '@/lib/editorial';

export const Route = createFileRoute('/enotita/$slug')({
  loader: async ({ params }) => {
    const bundle = await publicContent();
    const category = publicationCategories(bundle.categories)[params.slug];
    if (!category) throw notFound();
    return category;
  },
  head: ({ loaderData, matches }) => companyHead(matches, loaderData?.name ?? 'Ενότητα', loaderData?.description),
  component: () => <CategoryPage slug={Route.useParams().slug}/>,
});