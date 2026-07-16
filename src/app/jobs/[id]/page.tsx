import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbSchema, JobPostingSchema } from "@/components/seo/json-ld";
import { DEFAULT_LANGUAGE, isLanguage, translate, type Language } from "@/lib/i18n-shared";
import { fetchJob } from "@/lib/server-api";
import { SITE_URL } from "@/lib/seo";
import JobDetailView from "./job-detail-view";

type PageProps = {
  params: Promise<{ id: string }>;
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

/** Open listings are the only ones worth indexing, and the only ones Google allows to be marked up. */
function isLive(job: { status: string; applicationsClosed: boolean }): boolean {
  return job.status === "OPEN" && !job.applicationsClosed;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [job, language] = await Promise.all([fetchJob(id), langFrom(searchParams)]);
  if (!job) return { title: translate(language, "titles.not_found"), robots: { index: false } };

  const title = translate(language, "titles.job_detail", {
    title: job.title,
    district: job.district,
  });
  const description =
    job.description?.trim() ||
    translate(language, "descriptions.job_detail", {
      title: job.title,
      district: job.district,
      employer: job.employerName,
    });

  return {
    // Absolute, because the title already carries the brand and the layout template would
    // otherwise append it a second time.
    title: { absolute: title },
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    /**
     * A filled or closed listing stays reachable for anyone holding the link, but asking Google to
     * index a job nobody can apply for earns a thin page, and for JobPosting specifically a stale
     * posting is a structured-data violation.
     */
    robots: isLive(job) ? undefined : { index: false, follow: true },
    openGraph: { title, description, url: `/jobs/${job.id}`, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

export default async function JobDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const job = await fetchJob(id);

  // A missing job has to be a real 404 rather than a styled body under a 200, which Google would
  // keep in the index as a soft 404.
  if (!job) notFound();

  const language = await langFrom(searchParams);
  const url = `${SITE_URL}/jobs/${job.id}`;

  return (
    <>
      {/* Only live listings carry JobPosting markup. See the robots note in generateMetadata. */}
      {isLive(job) && (
        <JobPostingSchema
          title={job.title}
          description={job.description}
          url={url}
          datePosted={job.createdAt}
          startTime={job.startTime}
          employerName={job.employerName}
          district={job.district}
          province={job.province}
          ratePerHour={job.ratePerHour}
          durationHours={job.durationHours}
          headcount={job.headcount}
        />
      )}
      <BreadcrumbSchema
        items={[
          { name: translate(language, "common.nav.home"), url: SITE_URL },
          { name: translate(language, "common.nav.jobs"), url: `${SITE_URL}/jobs` },
          { name: job.title, url },
        ]}
      />
      <JobDetailView job={job} />
    </>
  );
}
