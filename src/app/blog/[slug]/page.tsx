import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllPosts, getPost } from "@/lib/blog/posts";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const post = getPost(params.slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
    },
  };
}

function coverUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}/1200/630`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const mdxComponents = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      className="mt-10 text-2xl font-bold tracking-tight text-neutral-900 first:mt-0"
      {...props}
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      className="mt-8 text-xl font-semibold text-neutral-900 first:mt-0"
      {...props}
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mt-4 leading-relaxed text-neutral-700" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className="mt-4 list-disc space-y-1.5 pl-6 text-neutral-700"
      {...props}
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className="mt-4 list-decimal space-y-1.5 pl-6 text-neutral-700"
      {...props}
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-6 border-l-4 border-primary-500 pl-5 text-neutral-600 italic"
      {...props}
    />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mt-6 overflow-x-auto rounded-xl border border-neutral-200">
      <table
        className="min-w-full divide-y divide-neutral-200 text-sm"
        {...props}
      />
    </div>
  ),
  thead: (props: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-neutral-50" {...props} />
  ),
  th: (props: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500"
      {...props}
    />
  ),
  td: (props: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className="px-4 py-3 text-neutral-700" {...props} />
  ),
  tr: (props: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className="even:bg-neutral-50/50" {...props} />
  ),
  a: ({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="font-medium text-primary-700 underline underline-offset-2 hover:text-primary-900"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-neutral-200" />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-neutral-900" {...props} />
  ),
};

export default function BlogPost({ params }: PageProps) {
  const post = getPost(params.slug);
  if (!post) notFound();

  return (
    <div className="py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/inspiration"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          ← Back to inspiration
        </Link>

        {/* Category + reading time */}
        <div className="mt-6 flex items-center gap-3">
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
            {post.category}
          </span>
          <span className="text-sm text-neutral-500">
            {post.readingTime} min read
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {post.title}
        </h1>

        <p className="mt-3 text-lg text-neutral-600">{post.description}</p>

        {/* Author + date */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
            W
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {post.author}
            </p>
            <p className="text-xs text-neutral-500">{formatDate(post.date)}</p>
          </div>
        </div>
      </div>

      {/* Cover image */}
      <div className="mx-auto mt-8 max-w-4xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl(post.coverImage)}
          alt={post.title}
          className="aspect-[16/7] w-full rounded-3xl object-cover"
        />
      </div>

      {/* Article body */}
      <article className="mx-auto mt-10 max-w-3xl">
        <MDXRemote source={post.content} components={mdxComponents} />
      </article>

      {/* Tags */}
      {post.tags.length > 0 && (
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-6">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center">
        <p className="text-lg font-semibold text-neutral-900">
          Ready to start planning?
        </p>
        <p className="mt-1 text-neutral-600">
          Build your trip itinerary and track your budget — free, no credit card
          needed.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Start planning for free →
        </Link>
      </div>
    </div>
  );
}
