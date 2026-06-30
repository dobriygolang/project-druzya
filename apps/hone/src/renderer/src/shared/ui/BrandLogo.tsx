import markUrl from '@shared/assets/druzya-mark.svg';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 32, className }: BrandLogoProps): JSX.Element {
  return (
    <img
      src={markUrl}
      alt="Hone"
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ display: 'block' }}
    />
  );
}
