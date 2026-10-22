// Album art, or a soft placeholder when a song has none.
export function Artwork({
  src,
  alt,
  className = "",
  style,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-[linear-gradient(165deg,#a9dcd6_0%,#2f6f7e_100%)] ${className}`}
        style={style}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} draggable={false} className={`object-cover ${className}`} style={style} />;
}
