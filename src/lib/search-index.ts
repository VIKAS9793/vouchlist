import { scoreDocument } from "./fuzzy";
import type { PublicRoutePath } from "./sitemap-routes";

export type SearchEntry = {
  id: string;
  title: string;
  /** Page the entry lives on, used as the result group heading. */
  page: string;
  /**
   * Destination. Restricted to public product pages, so sign-in, the account
   * page, staff insights and the researcher security policy can never be
   * surfaced by onsite search, even by accident.
   */
  to: PublicRoutePath;
  hash?: string;
  summary: string;
  /** Extra words people are likely to type, including common alternatives. */
  keywords: string;
};

/**
 * Static, in memory index of every public route and its sections. It ships in
 * the bundle, so search returns results on the first keystroke with no fetch.
 */
export const searchEntries: SearchEntry[] = [
  {
    id: "home",
    title: "VouchList home",
    page: "Home",
    to: "/",
    summary:
      "The shared list that keeps your group's trusted recommendations alive inside WhatsApp.",
    keywords: "overview start landing vouchlist whatsapp neighbourhood recommendations",
  },
  {
    id: "home-problem",
    title: "Why recommendations disappear",
    page: "Home",
    to: "/",
    hash: "problem",
    summary:
      "Good vendor replies scroll away in minutes, so the same question is asked again every week.",
    keywords: "problem information decay lost scroll chat history repeat questions",
  },
  {
    id: "home-how",
    title: "How VouchList works",
    page: "Home",
    to: "/",
    hash: "how-it-works",
    summary: "Ask, save, sort and find again. Four steps that run beside your existing group.",
    keywords: "how it works steps process save sort find again",
  },
  {
    id: "communities-pilot",
    title: "Who it is for",
    page: "Communities",
    to: "/communities",
    hash: "pilot",
    summary:
      "Dense housing societies where neighbours already share recommendations in WhatsApp groups.",
    keywords: "communities housing societies residents admins groups whatsapp",
  },
  {
    id: "features",
    title: "Features overview",
    page: "Features",
    to: "/features",
    summary: "Everything a community needs, and nothing it has to learn.",
    keywords: "features product capabilities what it does",
  },
  {
    id: "features-capabilities",
    title: "Save and sort recommendations",
    page: "Features",
    to: "/features",
    hash: "capabilities",
    summary: "Intent detection turns everyday replies into trusted vendor cards with categories.",
    keywords: "save recommendations vendor contacts categories shared list search",
  },
  {
    id: "features-search",
    title: "Plain language search",
    page: "Features",
    to: "/features",
    hash: "benefits",
    summary:
      "Ask for a plumber, electrician, AC service or tutor and get vendors your neighbours vouched for.",
    keywords:
      "search find plumber electrician ac service carpenter tutor maid painter vendor lookup query",
  },
  {
    id: "home-usp",
    title: "Why VouchList is different",
    page: "Home",
    to: "/",
    hash: "why-vouchlist",
    summary: "No ads, no sponsored placements, no directory of strangers. Only human vouches.",
    keywords: "usp different no ads sponsored directory justdial google reviews trust",
  },
  {
    id: "how-architecture",
    title: "How the system fits together",
    page: "How it works",
    to: "/how-it-works",
    hash: "architecture",
    summary: "The flow from a WhatsApp message to a stored, searchable community entry.",
    keywords: "architecture flow diagram pipeline system design technical",
  },
  {
    id: "how",
    title: "How it works",
    page: "How it works",
    to: "/how-it-works",
    summary: "A walkthrough of a real request, from question to saved recommendation.",
    keywords: "how it works walkthrough demo conversation example",
  },
  {
    id: "how-principles",
    title: "Principles we build on",
    page: "How it works",
    to: "/how-it-works",
    hash: "principles",
    summary: "Consent first, community owned, and useful without changing anyone's habits.",
    keywords: "principles values consent community owned habits",
  },
  {
    id: "communities",
    title: "Communities",
    page: "Communities",
    to: "/communities",
    summary: "Built for residential societies, apartment groups and neighbourhood WhatsApp groups.",
    keywords: "communities societies apartments rwa committee admins residents groups",
  },
  {
    id: "communities-intelligence",
    title: "A memory your community keeps",
    page: "Communities",
    to: "/communities",
    hash: "community-intelligence",
    summary: "Every vouch strengthens the shared memory your neighbours can search later.",
    keywords: "shared memory community list saved answers vouches",
  },
  {
    id: "trust",
    title: "Trust and privacy",
    page: "Trust",
    to: "/trust",
    summary: "What VouchList stores, what it never stores, and who stays in control.",
    keywords: "trust privacy security data control safety",
  },
  {
    id: "trust-privacy",
    title: "What we do and do not store",
    page: "Trust",
    to: "/trust",
    hash: "privacy",
    summary:
      "Recommendation entries are saved. Ordinary conversation is not, and admins can delete anything.",
    keywords: "privacy notice data storage delete retention gdpr consent admins contact",
  },
  {
    id: "trust-architecture",
    title: "Trust architecture",
    page: "Trust",
    to: "/trust",
    hash: "trust-architecture",
    summary: "Consent at onboarding, community ownership of the list, and no vendor payments.",
    keywords: "trust architecture consent ownership no paid listings",
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    page: "FAQ",
    to: "/faq",
    summary: "Answers committees ask before switching VouchList on.",
    keywords: "faq questions answers help support",
  },
  {
    id: "faq-app",
    title: "Does everyone need to install an app?",
    page: "FAQ",
    to: "/faq",
    summary: "No. Residents keep using WhatsApp exactly as they do today.",
    keywords: "app install download whatsapp native no app",
  },
  {
    id: "faq-reading",
    title: "Does VouchList read our whole group chat?",
    page: "FAQ",
    to: "/faq",
    summary: "Only recommendation requests and replies are saved. Ordinary conversation is not.",
    keywords: "read chat privacy messages monitoring surveillance",
  },
  {
    id: "faq-control",
    title: "Who controls the list?",
    page: "FAQ",
    to: "/faq",
    summary: "The community does. Admins can edit, remove or delete the entire list.",
    keywords: "control ownership admin delete edit list",
  },
  {
    id: "faq-ads",
    title: "Can vendors pay to be listed?",
    page: "FAQ",
    to: "/faq",
    summary: "No. There are no ads and no sponsored placements.",
    keywords: "vendors pay ads sponsored paid listing advertising",
  },
  {
    id: "faq-search",
    title: "How does search work?",
    page: "FAQ",
    to: "/faq",
    summary: "Ask in plain language and VouchList answers with vendors your community vouched for.",
    keywords: "search query plain language ask reliable ac service",
  },
  {
    id: "faq-join",
    title: "How do we get VouchList for our society?",
    page: "FAQ",
    to: "/faq",
    hash: "waitlist",
    summary: "Join the waitlist and we walk your committee through the consent step.",
    keywords: "join waitlist signup early access onboarding society request",
  },
  {
    id: "waitlist",
    title: "Join the waitlist",
    page: "Home",
    to: "/",
    hash: "waitlist",
    summary: "Request early access for your community.",
    keywords: "waitlist sign up register early access join contact email",
  },
];

export type SearchResult = SearchEntry & { score: number };

/** Ranks the index for a query. Empty queries return the default suggestions. */
export function searchSite(query: string, limit = 8): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return searchEntries
      .filter((entry) => !entry.hash || entry.id === "waitlist")
      .slice(0, limit)
      .map((entry) => ({ ...entry, score: 0 }));
  }

  return searchEntries
    .map((entry) => ({
      ...entry,
      score: scoreDocument(trimmed, [
        { text: entry.title.toLowerCase(), weight: 1 },
        { text: entry.keywords.toLowerCase(), weight: 0.85 },
        { text: entry.summary.toLowerCase(), weight: 0.6 },
        { text: entry.page.toLowerCase(), weight: 0.5 },
      ]),
    }))
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
