import {
  SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_LOGO, SITE_ALTERNATE_NAMES,
  SOCIAL_PROFILES, ORG_ID, WEBSITE_ID, BUSINESS_EMAIL, BUSINESS_PHONE, BUSINESS_ADDRESS,
} from "@/lib/seo";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Pre-built schemas

/**
 * The brand entity. Google spell-corrects unfamiliar names ("MpahMapu" → "Mahmapu") until it's
 * confident the brand exists, so this states the name, its legitimate variants, a real logo and
 * every profile that corroborates it - under a stable @id the other schemas point back to, so
 * they read as one entity instead of three unrelated ones.
 */
export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        legalName: SITE_NAME,
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: SITE_LOGO,
          width: 512,
          height: 512,
          caption: SITE_NAME,
        },
        image: SITE_LOGO,
        description: SITE_DESCRIPTION,
        email: BUSINESS_EMAIL,
        telephone: BUSINESS_PHONE,
        address: {
          "@type": "PostalAddress",
          streetAddress: BUSINESS_ADDRESS.streetAddress,
          addressLocality: BUSINESS_ADDRESS.addressLocality,
          addressRegion: BUSINESS_ADDRESS.addressRegion,
          addressCountry: BUSINESS_ADDRESS.addressCountry,
        },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: BUSINESS_EMAIL,
          telephone: BUSINESS_PHONE,
          areaServed: "RW",
          availableLanguage: ["en", "rw", "fr", "sw"],
        },
        // Empty until real profiles are configured. An unverifiable sameAs is worse than none.
        ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES } : {}),
        foundingDate: "2025",
        areaServed: {
          "@type": "Country",
          name: "Rwanda",
        },
      }}
    />
  );
}

export function WebSiteSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        // Ties the site to the brand entity above rather than standing alone.
        publisher: { "@id": ORG_ID },
        inLanguage: ["en", "rw", "fr", "sw"],
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/browse?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  );
}

export function LocalBusinessSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "EmploymentAgency",
        "@id": `${SITE_URL}/#localbusiness`,
        // Same brand, described as a business - parentOrganization keeps it one entity.
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAMES,
        parentOrganization: { "@id": ORG_ID },
        url: SITE_URL,
        logo: SITE_LOGO,
        image: SITE_LOGO,
        description: "On-demand workforce platform connecting employers with verified workers in Rwanda.",
        email: BUSINESS_EMAIL,
        telephone: BUSINESS_PHONE,
        ...(SOCIAL_PROFILES.length > 0 ? { sameAs: SOCIAL_PROFILES } : {}),
        address: {
          "@type": "PostalAddress",
          streetAddress: BUSINESS_ADDRESS.streetAddress,
          addressLocality: BUSINESS_ADDRESS.addressLocality,
          addressRegion: BUSINESS_ADDRESS.addressRegion,
          addressCountry: BUSINESS_ADDRESS.addressCountry,
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: -1.9403,
          longitude: 29.8739,
        },
        openingHoursSpecification: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "00:00",
          closes: "23:59",
        },
        priceRange: "$$",
        areaServed: {
          "@type": "City",
          name: "Rwanda",
        },
      }}
    />
  );
}

export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

/**
 * Blog post markup. Every post is a fresh page that names the brand and points back at the
 * Organization node - which is exactly the corroboration Google wants before it stops treating an
 * unfamiliar name as a typo. `publisher` is a reference to ORG_ID, not a duplicate definition, so
 * the whole site stays one entity.
 */
export function ArticleSchema({
  title,
  description,
  url,
  imageUrl,
  publishedAt,
  updatedAt,
}: {
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        ...(description ? { description } : {}),
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: imageUrl || SITE_LOGO,
        ...(publishedAt ? { datePublished: publishedAt } : {}),
        ...(updatedAt ? { dateModified: updatedAt } : {}),
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        isPartOf: { "@id": WEBSITE_ID },
      }}
    />
  );
}

/**
 * A worker's public profile, tied back to the Organization as the platform they work through, so
 * profiles reinforce the brand entity rather than reading as unaffiliated strangers.
 *
 * aggregateRating is emitted only for workers with genuine reviews. Every worker is seeded at 5.0
 * with a phantom first review (see ratingInfo), and marking up a rating no human left is exactly
 * what Google's structured-data policy treats as fabricated.
 */
export function PersonSchema({
  name,
  url,
  imageUrl,
  jobTitle,
  locality,
  rating,
  ratingCount,
}: {
  name: string;
  url: string;
  imageUrl?: string | null;
  jobTitle?: string | null;
  locality?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
}) {
  const realReviews = (ratingCount ?? 0) - 1;
  const hasReviews = realReviews > 0 && rating != null;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Person",
        name,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        ...(imageUrl ? { image: imageUrl } : {}),
        ...(jobTitle ? { jobTitle } : {}),
        ...(locality
          ? {
              address: {
                "@type": "PostalAddress",
                addressLocality: locality,
                addressCountry: "RW",
              },
            }
          : {}),
        worksFor: { "@id": ORG_ID },
        ...(hasReviews
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: rating,
                reviewCount: realReviews,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
      }}
    />
  );
}

/**
 * A live job listing. This is the only schema on the site eligible for a rich result in Google's
 * jobs experience, which is why callers pass open listings only: Google requires that a marked-up
 * posting still accept applicants, and demotes sites that leave stale ones up.
 *
 * validThrough is derived from the shift's own end. Without it Google keeps surfacing a listing
 * long after the work has happened.
 */
export function JobPostingSchema({
  title,
  description,
  url,
  datePosted,
  startTime,
  employerName,
  district,
  province,
  ratePerHour,
  durationHours,
  headcount,
}: {
  title: string;
  description?: string | null;
  url: string;
  datePosted: string;
  startTime?: string | null;
  employerName: string;
  district: string;
  province?: string | null;
  ratePerHour: number;
  durationHours?: number | null;
  headcount?: number | null;
}) {
  const validThrough = (() => {
    if (!startTime) return null;
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return null;
    return new Date(start.getTime() + (durationHours ?? 0) * 3600_000).toISOString();
  })();

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title,
        // Google drops a JobPosting with no description, so fall back to a factual sentence rather
        // than omitting the property and losing the rich result outright.
        description:
          description?.trim() ||
          `${title} in ${district}, Rwanda. Posted by ${employerName} on ${SITE_NAME}.`,
        datePosted,
        ...(validThrough ? { validThrough } : {}),
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        employmentType: "TEMPORARY",
        hiringOrganization: { "@type": "Organization", name: employerName },
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: district,
            ...(province ? { addressRegion: province } : {}),
            addressCountry: "RW",
          },
        },
        baseSalary: {
          "@type": "MonetaryAmount",
          currency: "RWF",
          value: { "@type": "QuantitativeValue", value: ratePerHour, unitText: "HOUR" },
        },
        ...(headcount ? { totalJobOpenings: headcount } : {}),
        directApply: true,
        isPartOf: { "@id": WEBSITE_ID },
      }}
    />
  );
}

export function FAQSchema({ faqs }: { faqs: { question: string; answer: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      }}
    />
  );
}

export function ServiceSchema({ name, description, url }: { name: string; description: string; url: string }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name,
        description,
        url,
        // Reference the brand entity rather than declaring a second, unlinked Organization.
        provider: { "@id": ORG_ID },
        areaServed: {
          "@type": "Country",
          name: "Rwanda",
        },
        serviceType: "On-demand workforce",
      }}
    />
  );
}

/**
 * The Ask Motari app itself.
 *
 * SoftwareApplication is what a search engine understands an app to be, and it
 * is the only schema here that can carry a version, a size, a price and the
 * platform it runs on. Google will not invent those from prose, and without
 * them the download page competes as an ordinary article against pages that
 * declare themselves as software.
 *
 * The version and size are passed in rather than written here, because they
 * come from whatever release is actually published: a number hard-coded into a
 * schema is a number that will one day be a lie told to a crawler.
 */
export function MobileAppSchema({
  version,
  sizeBytes,
  updatedAt,
  downloadUrl,
}: {
  version?: string;
  sizeBytes?: number;
  updatedAt?: string;
  downloadUrl?: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "MobileApplication",
        "@id": `${SITE_URL}/app#app`,
        name: "Ask Motari",
        alternateName: ["Ask Motari app", "Motari"],
        applicationCategory: "TravelApplication",
        operatingSystem: "Android 6.0 and later",
        url: `${SITE_URL}/app`,
        ...(downloadUrl ? { downloadUrl, installUrl: `${SITE_URL}/app` } : {}),
        ...(version ? { softwareVersion: version } : {}),
        ...(sizeBytes ? { fileSize: `${Math.round(sizeBytes / 1024 / 1024)}MB` } : {}),
        ...(updatedAt ? { datePublished: updatedAt } : {}),
        description:
          "Ask Motari is the moto taxi app for MpahMapu in Rwanda. Ask for a moto or send "
          + "a parcel in a few taps, agree the fare before the ride starts, and follow it on "
          + "the map. Motari take the work, get paid, and settle the daily fee.",
        inLanguage: ["en", "fr", "rw", "sw"],
        // Free to install and free to ask for a ride; the fare is between the
        // passenger and the motari, and stating a price of 0 for the software
        // is what the offer is actually about.
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "RWF",
          availability: "https://schema.org/InStock",
        },
        featureList: [
          "Ask for a moto taxi from the map or by typing the place",
          "Send a parcel by moto",
          "A price agreed before the ride starts",
          "Verified motari with plates you can check",
          "Follow the ride on the map, in streets or satellite",
          "Spoken turn by turn directions for the motari",
          "Pay in cash or by mobile money",
          "English, French, Kinyarwanda and Kiswahili",
        ],
        // Reference the brand entity rather than declaring a second, unlinked one.
        publisher: { "@id": ORG_ID },
        author: { "@id": ORG_ID },
        areaServed: { "@type": "Country", name: "Rwanda" },
      }}
    />
  );
}
