import Image from "next/image";
import type { ArtworkImage } from "@/lib/artwork/reveal";

function isWikimedia(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "upload.wikimedia.org" ||
        parsed.hostname === "thumb.wikimedia.org")
    );
  } catch {
    return false;
  }
}

export function ArtworkFigure({ image }: { image: ArtworkImage }) {
  return (
    <figure className="flex flex-col gap-1">
      {isWikimedia(image.url) ? (
        <Image
          src={image.url}
          alt={image.alt}
          width={960}
          height={640}
          sizes="(max-width: 32rem) 100vw, 32rem"
          className="h-auto max-h-80 w-full rounded-xl border border-border bg-muted object-contain"
        />
      ) : (
        // Hosts outside the Next image allowlist still render, without optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={image.alt}
          className="h-auto max-h-80 w-full rounded-xl border border-border bg-muted object-contain"
        />
      )}
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        {image.credit}
      </figcaption>
    </figure>
  );
}
