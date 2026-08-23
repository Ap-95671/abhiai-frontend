type RichPostTextProps = {
  className?: string;
  text: string;
  onViewHashtag?: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

const SOCIAL_TOKEN_PATTERN = /((?<![\p{L}\p{N}_])(?:#[\p{L}\p{N}_]{1,50}|@[A-Za-z0-9_]{3,30}))/gu;

export function RichPostText({
  className,
  text,
  onViewHashtag,
  onViewProfile,
}: RichPostTextProps) {
  return (
    <p className={className}>
      {text.split(SOCIAL_TOKEN_PATTERN).map((part, index) => {
        if (part.startsWith("#") && onViewHashtag) {
          return (
            <button
              className="inline-hashtag"
              key={`${part}-${index}`}
              onClick={() => onViewHashtag(part.slice(1))}
              type="button"
            >
              {part}
            </button>
          );
        }
        if (part.startsWith("@")) {
          return (
            <button
              className="inline-mention"
              key={`${part}-${index}`}
              onClick={() => onViewProfile(part.slice(1).toLowerCase())}
              type="button"
            >
              {part}
            </button>
          );
        }
        return part;
      })}
    </p>
  );
}
