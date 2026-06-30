// Chrome — top-left brand mark (traffic lights show on hover in that corner).
import { memo, type CSSProperties } from 'react';

import { BrandLogo } from '@shared/ui/BrandLogo';

const LOGO_ROOT_STYLE: CSSProperties = {
  position: 'absolute',
  top: 52,
  left: 24,
  zIndex: 10,
  pointerEvents: 'none',
  WebkitAppRegion: 'no-drag',
};

export const Wordmark = memo(function Wordmark() {
  return (
    <div style={LOGO_ROOT_STYLE} className="no-select">
      <BrandLogo size={28} />
    </div>
  );
});
