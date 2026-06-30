import { useEffect, useRef, useState, type ReactNode } from 'react';

const REF_W = 1280;
const REF_H = 800;

interface DemoEmbedFrameProps {
  compact?: boolean;
  children: ReactNode;
}

export function DemoEmbedFrame({ compact = false, children }: DemoEmbedFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      setScale(Math.min(w / REF_W, h / REF_H));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const scaledW = REF_W * scale;
  const scaledH = REF_H * scale;

  return (
    <div
      ref={hostRef}
      className={`hone-embed-frame${compact ? ' hone-embed-frame--compact' : ''}`}
    >
      <div
        className="hone-embed-frame__viewport"
        style={{ width: scaledW, height: scaledH }}
      >
        <div
          className="hone-embed-frame__stage"
          style={{
            width: REF_W,
            height: REF_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
