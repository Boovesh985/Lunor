import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/utils';

export type DevicePlatform = 'ios' | 'android';

export const DEVICES = {
  ios: { width: 390, height: 844, radius: 54, statusBar: 50, bottomBar: 22, bezel: 11, label: 'iPhone' },
  android: { width: 400, height: 860, radius: 40, statusBar: 34, bottomBar: 18, bezel: 9, label: 'Android' },
} as const;

/** Relative luminance of "rgb(...)" / "#rrggbb" — decides dark vs light status bar text. */
function isLightColor(color?: string): boolean {
  if (!color) return true;
  let r = 255;
  let g = 255;
  let b = 255;
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(color);
  if (rgb) [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  else if (/^#([0-9a-f]{6})/i.test(color)) {
    const hex = color.slice(1, 7);
    [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6;
}

function StatusIcons({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-[5px]" style={{ color }}>
      <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor" aria-hidden>
        <rect x="0" y="7" width="3" height="4" rx="0.8" />
        <rect x="5" y="5" width="3" height="6" rx="0.8" />
        <rect x="10" y="2.5" width="3" height="8.5" rx="0.8" />
        <rect x="15" y="0" width="3" height="11" rx="0.8" />
      </svg>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden>
        <path d="M8 2.3c2.3 0 4.4.9 6 2.4l1.1-1.2A10.3 10.3 0 0 0 8 .6C5.3.6 2.8 1.7.9 3.5L2 4.7a8.6 8.6 0 0 1 6-2.4Zm0 3.3c1.4 0 2.7.5 3.7 1.4l1.1-1.2A7.1 7.1 0 0 0 8 3.9 7.1 7.1 0 0 0 3.2 5.8L4.3 7c1-.9 2.3-1.4 3.7-1.4Zm0 3.3c-.6 0-1.1.2-1.5.6L8 11l1.5-1.5c-.4-.4-.9-.6-1.5-.6Z" />
      </svg>
      <svg width="27" height="12" viewBox="0 0 27 12" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="23" height="11" rx="3.5" stroke="currentColor" opacity="0.4" />
        <rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor" />
        <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4Z" fill="currentColor" opacity="0.45" />
      </svg>
    </div>
  );
}

interface PhoneFrameProps {
  platform: DevicePlatform;
  statusStyle: 'light' | 'dark' | 'auto';
  topColor?: string;
  bottomColor?: string;
  children: ReactNode;
  overlay?: ReactNode;
  className?: string;
}

/** A CSS device mock that scales itself to fit its container. */
export function PhoneFrame({ platform, statusStyle, topColor, bottomColor, children, overlay, className }: PhoneFrameProps) {
  const device = DEVICES[platform];
  const outerW = device.width + device.bezel * 2;
  const outerH = device.height + device.bezel * 2;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.7);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setScale(Math.max(0.35, Math.min(1, (height - 8) / outerH, (width - 8) / outerW)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [outerH, outerW]);

  const textColor = statusStyle === 'light' ? '#fff' : statusStyle === 'dark' ? '#000' : isLightColor(topColor) ? '#000' : '#fff';
  const indicatorColor = isLightColor(bottomColor) ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)';

  return (
    <div ref={containerRef} className={cn('flex h-full w-full items-start justify-center overflow-hidden', className)}>
      <div style={{ width: outerW * scale, height: outerH * scale }} className="relative shrink-0">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: outerW, height: outerH, transform: scale > 0.999 ? undefined : `scale(${scale})` }}
        >
          {/* Device body */}
          <div
            className="relative h-full w-full bg-[#111] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9),0_0_0_1.5px_#2c2c2c,inset_0_0_0_1.5px_#3a3a3a]"
            style={{ borderRadius: device.radius + device.bezel, padding: device.bezel }}
          >
            {/* Side buttons */}
            <span className="absolute -left-[3px] top-[150px] h-[34px] w-[3px] rounded-l bg-[#2a2a2a]" />
            <span className="absolute -left-[3px] top-[205px] h-[62px] w-[3px] rounded-l bg-[#2a2a2a]" />
            <span className="absolute -right-[3px] top-[220px] h-[92px] w-[3px] rounded-r bg-[#2a2a2a]" />

            {/* Screen */}
            <div className="relative flex h-full w-full flex-col overflow-hidden bg-white" style={{ borderRadius: device.radius }}>
              <div
                className="relative z-10 flex shrink-0 items-center justify-between font-sans"
                style={{
                  height: device.statusBar,
                  background: topColor ?? '#fff',
                  padding: platform === 'ios' ? '12px 34px 0 46px' : '6px 22px 0 26px',
                  transition: 'background-color 200ms ease',
                }}
              >
                <span style={{ color: textColor, fontSize: platform === 'ios' ? 16 : 14, fontWeight: 600, letterSpacing: -0.2 }}>9:41</span>
                {platform === 'ios' ? (
                  <span className="absolute left-1/2 top-[11px] h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
                ) : (
                  <span className="absolute left-1/2 top-[10px] h-[14px] w-[14px] -translate-x-1/2 rounded-full bg-black ring-2 ring-[#1b1b1b]" />
                )}
                <StatusIcons color={textColor} />
              </div>

              <div className="relative min-h-0 flex-1">{children}</div>

              <div
                className="flex shrink-0 items-center justify-center"
                style={{ height: device.bottomBar, background: bottomColor ?? '#fff', transition: 'background-color 200ms ease' }}
              >
                <span className="h-[5px] w-[134px] rounded-full" style={{ background: indicatorColor }} />
              </div>

              {overlay && <div className="absolute inset-0 z-20">{overlay}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
