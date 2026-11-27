export function licenseIsFree(shortName: string, extra = ""): boolean {
  const short = shortName.trim().toLowerCase();
  const blob = `${short} ${extra}`.toLowerCase();
  if (
    /\bnc\b/.test(blob) ||
    /\bnd\b/.test(blob) ||
    blob.includes("noncommercial") ||
    blob.includes("non-commercial") ||
    blob.includes("no derivatives") ||
    blob.includes("all rights reserved")
  ) {
    return false;
  }
  return (
    short === "public domain" ||
    short === "pd" ||
    short.startsWith("cc0") ||
    short.startsWith("cc by-sa") ||
    short.startsWith("cc by") ||
    short === "no restrictions"
  );
}

export function stripHtml(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const FILE_NOISE =
  /signature|logo|\bicon\b|stamp|coin|autograph|qr.?code|diagram only|fragment|detail|negative|googly|replica|restoration|\bcopy\b|\bcrop\b|baby|child|lovebird|smooch|kissing|\bpanel\b|\bwing\b|\bhell\b|\beden\b|\bparadise\b/;

export function commonsFileScore(
  fileTitle: string,
  search: string,
  hints: readonly string[] = [],
): number {
  const hay = fileTitle.toLowerCase();
  if (FILE_NOISE.test(hay)) return -1;
  const words = searchWords(search);
  if (words.length === 0) return 0;
  const hits = words.filter((word) => hay.includes(word)).length;
  if (hits === 0) return 0;
  const hintHits = hints.filter((hint) => {
    const key = hint.toLowerCase().replace(/[^a-z0-9]/g, "");
    return key.length > 2 && hay.includes(key);
  }).length;
  return hits * 10 + hintHits;
}

function searchWords(search: string): string[] {
  return search
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 2 && word !== "the" && word !== "and");
}

function imageUrlOf(info: { url?: string; thumburl?: string }): string | null {
  const candidates = [info.thumburl, info.url];
  for (const url of candidates) {
    if (!url) continue;
    if (
      url.startsWith("https://upload.wikimedia.org/") ||
      url.startsWith("https://thumb.wikimedia.org/")
    ) {
      return url;
    }
  }
  return null;
}

export type CommonsCandidate = {
  url: string;
  mime: string;
  fileTitle: string;
  license: string;
  artist: string;
  licenseUrl: string;
  score: number;
};

type ImageInfo = {
  url?: string;
  thumburl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
};

type CommonsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: ImageInfo[];
      }
    >;
  };
};

function creditLine(input: {
  artist: string;
  fileTitle: string;
  license: string;
  licenseUrl: string;
}): string {
  const title = input.fileTitle.replace(/^File:/i, "").replace(/_/g, " ");
  return [input.artist, title, input.license, input.licenseUrl, "Wikimedia Commons"]
    .filter((part) => part.length > 0)
    .join(" · ");
}

export function commonsCredit(input: {
  artist: string;
  fileTitle: string;
  license: string;
  licenseUrl: string;
}): string {
  return creditLine(input);
}

export function pickCommonsImage(
  payload: unknown,
  search: string,
  hints: readonly string[] = [],
): { url: string; alt: string; credit: string } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const pages = (payload as CommonsResponse).query?.pages;
  if (!pages) return null;
  const candidates: CommonsCandidate[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = info.mime ?? "";
    if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue;
    const url = imageUrlOf(info);
    if (!url) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value);
    const usage = stripHtml(meta.UsageTerms?.value);
    const restrictions = stripHtml(meta.Restrictions?.value);
    if (!licenseIsFree(license, `${usage} ${restrictions}`)) continue;
    const fileTitle = page.title ?? "";
    let score = commonsFileScore(fileTitle, search, hints);
    if (score < 0) continue;
    if (/^public domain$|^pd$|^cc0/.test(license.trim().toLowerCase())) {
      score += 5;
    }
    candidates.push({
      url,
      mime,
      fileTitle,
      license,
      artist: stripHtml(meta.Artist?.value),
      licenseUrl: stripHtml(meta.LicenseUrl?.value),
      score,
    });
  }
  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.fileTitle.length - right.fileTitle.length;
  });
  const best = candidates[0];
  if (!best || best.score <= 0) return null;
  const words = searchWords(search);
  const needed = Math.min(words.length, Math.max(1, Math.ceil(words.length / 2)));
  if (Math.floor(best.score / 10) < needed) return null;
  return {
    url: best.url,
    alt: search,
    credit: creditLine(best),
  };
}

export async function searchCommonsArtwork(
  title: string,
  hints: readonly string[] = [],
): Promise<{ url: string; alt: string; credit: string } | null> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("origin", "*");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", `${title} filetype:bitmap`);
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", "12");
  endpoint.searchParams.set("prop", "imageinfo");
  endpoint.searchParams.set("iiprop", "url|extmetadata|mime");
  endpoint.searchParams.set("iiurlwidth", "960");
  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      accept: "application/json",
      "user-agent": "TriviaTrainer/1.0 (artwork backfill; educational)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  return pickCommonsImage(payload, title, hints);
}
