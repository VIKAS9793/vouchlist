type SmartImageProps = {
  /** Path to the legacy fallback, e.g. "/logo.png". AVIF/WebP siblings are used when present. */
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** Set for the LCP image only. */
  priority?: boolean;
  sizes?: string;
};

/**
 * Format-negotiating image. Serves AVIF, then WebP, then the original file,
 * always with intrinsic dimensions so nothing shifts while loading.
 */
export function SmartImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  sizes,
}: SmartImageProps) {
  const stem = src.replace(/\.(png|jpe?g)$/i, "");
  const hasModern = stem !== src;

  return (
    <picture>
      {hasModern && <source srcSet={`${stem}.avif`} type="image/avif" sizes={sizes} />}
      {hasModern && <source srcSet={`${stem}.webp`} type="image/webp" sizes={sizes} />}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}
