export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Pre-built schemas

export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "MpahMapu",
        url: "https://mpahmapu.com",
        logo: "https://mpahmapu.com/favicon.ico",
        description: "Rwanda's trusted on-demand workforce platform. Find verified workers for events, cleaning, security, driving, and more in Kigali.",
        email: "info@mpahmapu.com",
        telephone: "+250781121117",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Kigali",
          addressRegion: "Kigali City",
          addressCountry: "RW",
        },
        sameAs: [],
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
        name: "MpahMapu",
        url: "https://mpahmapu.com",
        description: "Find verified workers instantly or get hired for a job today.",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://mpahmapu.com/browse?q={search_term_string}",
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
        name: "MpahMapu",
        url: "https://mpahmapu.com",
        logo: "https://mpahmapu.com/favicon.ico",
        image: "https://mpahmapu.com/favicon.ico",
        description: "On-demand workforce platform connecting employers with verified workers in Kigali, Rwanda.",
        email: "info@mpahmapu.com",
        telephone: "+250781121117",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Kigali",
          addressRegion: "Kigali City",
          addressCountry: "RW",
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
          name: "Kigali",
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
        provider: {
          "@type": "Organization",
          name: "MpahMapu",
          url: "https://mpahmapu.com",
        },
        areaServed: {
          "@type": "Country",
          name: "Rwanda",
        },
        serviceType: "On-demand workforce",
      }}
    />
  );
}
