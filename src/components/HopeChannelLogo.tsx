interface AdventistLogoProps {
  className?: string;
  variant?: 'circle' | 'symbol' | 'signature';
  alt?: string;
}

/**
 * Official Seventh-day Adventist Identity System Logo
 * Designed & Refined by Types & Symbols in collaboration with the General Conference
 * Reference: https://www.typesandsymbols.com/pages/adventist-identity-system#gallery-4
 * Gallery #4: Official digital circular emblem featuring the cross, open Bible, and flame
 */
export function HopeChannelLogo({
  className = "w-8 h-8",
  variant = 'circle',
  alt = "Seventh-day Adventist Identity System Logo",
}: AdventistLogoProps) {
  const imageSrc =
    variant === 'symbol'
      ? '/adventist-symbol.png'
      : variant === 'signature'
      ? '/adventist-signature.png'
      : '/adventist-symbol-circle.png';

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`object-contain select-none rounded-full shrink-0 ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

// Alias for explicit naming across the app
export const AdventistLogo = HopeChannelLogo;


