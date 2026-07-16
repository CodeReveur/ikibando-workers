import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbSchema, PersonSchema } from "@/components/seo/json-ld";
import { DEFAULT_LANGUAGE, isLanguage, translate, type Language } from "@/lib/i18n-shared";
import { fetchWorker, fetchWorkerReviews } from "@/lib/server-api";
import { SITE_URL } from "@/lib/seo";
import WorkerDetailView from "./worker-detail-view";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
};

/**
 * ?lang is how the sitemap's hreflang alternates address each language, so a crawler asking for
 * the French variant has to get French metadata rather than the default.
 */
async function langFrom(searchParams: PageProps["searchParams"]): Promise<Language> {
  const { lang } = await searchParams;
  return isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
}

/** The worker's trade, localized, falling back to the label the API already resolved. */
function categoryLabel(
  language: Language,
  worker: { experienceType: string | null; categoryName: string | null },
): string {
  const slug = (worker.experienceType ?? "").toLowerCase();
  const key = `common.categories.${slug}`;
  const localized = slug ? translate(language, key) : null;
  if (localized && localized !== key) return localized;
  return worker.categoryName ?? translate(language, "common.general.worker");
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [worker, language] = await Promise.all([fetchWorker(slug), langFrom(searchParams)]);
  if (!worker) return { title: translate(language, "titles.not_found"), robots: { index: false } };

  const category = categoryLabel(language, worker);
  const location = worker.locationShort ?? worker.district ?? "Rwanda";
  const title = translate(language, "titles.worker_detail", { name: worker.name, category });
  const description = translate(language, "descriptions.worker_detail", {
    name: worker.name,
    category,
    location,
    completed: worker.completedJobs,
  });

  return {
    // Absolute, because the title already carries the brand and the layout's "%s | MpahMapu"
    // template would otherwise append it a second time.
    title: { absolute: title },
    description,
    alternates: { canonical: `/browse/${worker.id}` },
    openGraph: {
      title,
      description,
      url: `/browse/${worker.id}`,
      type: "profile",
      ...(worker.photoUrl ? { images: [{ url: worker.photoUrl }] } : {}),
    },
    twitter: {
      card: worker.photoUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(worker.photoUrl ? { images: [worker.photoUrl] } : {}),
    },
  };
}

export default async function WorkerDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const worker = await fetchWorker(slug);

  // A missing worker has to be a real 404. A styled "not found" body under a 200 tells Google the
  // URL is valid and leaves it in the index as a soft 404.
  if (!worker) notFound();

  const [reviews, language] = await Promise.all([fetchWorkerReviews(slug), langFrom(searchParams)]);

  const url = `${SITE_URL}/browse/${worker.id}`;

  return (
    <>
      <PersonSchema
        name={worker.name}
        url={url}
        imageUrl={worker.photoUrl}
        jobTitle={categoryLabel(language, worker)}
        locality={worker.district}
        rating={worker.rating}
        ratingCount={worker.ratingCount}
      />
      <BreadcrumbSchema
        items={[
          { name: translate(language, "common.nav.home"), url: SITE_URL },
          { name: translate(language, "common.nav.browse"), url: `${SITE_URL}/browse` },
          { name: worker.name, url },
        ]}
      />
      <WorkerDetailView worker={worker} reviews={reviews} />
    </>
  );
}
