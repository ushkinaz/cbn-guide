import { tx } from "@transifex/native";
export const DEFAULT_LOCALE = "en";
const KNOWN_LOCALE_FALLBACKS: Record<string, string> = {
  es_AR: "es",
  it_IT: "it",
  pl_PL: "pl",
  ru_RU: "ru",
  uk_UA: "uk",
};

function getTransifexLocaleCandidates(locale: string): string[] {
  const candidates: string[] = [];
  const mapped = KNOWN_LOCALE_FALLBACKS[locale];
  if (mapped) {
    candidates.push(mapped);
  }
  candidates.push(locale);

  const languageOnly = locale.split(/[_-]/u)[0];
  if (languageOnly && !candidates.includes(languageOnly)) {
    candidates.push(languageOnly);
  }

  return candidates;
}

export async function initializeUILocale(locale?: string): Promise<void> {
  if (!locale) return;

  let chain = Promise.reject<void>(new Error("start locale chain"));
  for (const candidate of getTransifexLocaleCandidates(locale)) {
    chain = chain.catch(() => tx.setCurrentLocale(candidate));
  }

  try {
    await chain;
  } catch {
    // All candidates failed; keep the default locale.
  }
}
