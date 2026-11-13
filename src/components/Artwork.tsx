import { coverAt } from "@/lib/cover";

// Album art, or a soft placeholder when a song has none. `size` is how big it
// shows, in CSS pixels, so a small one downloads a small picture.
export function Artwork({
  src,
  alt,
  className = "",
  style,
  size = 340,
}: {
  src: string | null | undefined;
  alt: string;
  size?: number;
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
  return <img src={coverAt(src, size)} alt={alt} loading="lazy" draggable={false} className={`object-cover ${className}`} style={style} />;
}
