import { type BlogPost, getAuthorBySlug, getCategoryBySlug } from "../../data/blog-content.ts";

interface ArticleSchemaProps {
  post: BlogPost;
}

/** Injects JSON-LD BlogPosting + BreadcrumbList schemas for article pages. */
export function ArticleSchema({ post }: ArticleSchemaProps) {
  const author   = getAuthorBySlug(post.author);
  const category = getCategoryBySlug(post.category);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: post.canonical,
    datePublished: post.publishedAt,
    ...(post.updatedAt ? { dateModified: post.updatedAt } : { dateModified: post.publishedAt }),
    author: author
      ? {
          "@type": "Person",
          name: author.name,
          description: author.bio,
          url: `https://www.bidwar.in/blog/author/${author.slug}`,
          ...(author.twitterHandle ? { sameAs: [`https://twitter.com/${author.twitterHandle.replace("@", "")}`] } : {}),
        }
      : { "@type": "Organization", name: "BidWar" },
    publisher: {
      "@type": "Organization",
      name: "BidWar",
      url: "https://www.bidwar.in",
      logo: {
        "@type": "ImageObject",
        url: "https://www.bidwar.in/bidwar-logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": post.canonical,
    },
    ...(post.heroImage ? { image: post.heroImage } : {}),
    ...(category ? { articleSection: category.name } : {}),
    keywords: post.tags.join(", "),
    timeRequired: `PT${post.readingTimeMinutes}M`,
    inLanguage: "en-IN",
    isPartOf: {
      "@type": "Blog",
      name: "BidWar Blog",
      url: "https://www.bidwar.in/blog",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",    item: "https://www.bidwar.in/" },
      { "@type": "ListItem", position: 2, name: "Blog",    item: "https://www.bidwar.in/blog" },
      ...(category
        ? [{ "@type": "ListItem", position: 3, name: category.name, item: `https://www.bidwar.in/blog/category/${category.slug}` }]
        : []),
      { "@type": "ListItem", position: category ? 4 : 3, name: post.title, item: post.canonical },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
}

/** JSON-LD for blog listing / category / tag pages. */
export function BlogListingSchema({
  name,
  description,
  url,
  posts,
}: {
  name: string;
  description: string;
  url: string;
  posts: BlogPost[];
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    hasPart: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: p.canonical,
      datePublished: p.publishedAt,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
