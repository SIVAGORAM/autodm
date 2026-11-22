'use client';

import Image from 'next/image';
import { type CSSProperties, useState } from 'react';

export function ProfileAvatar({
  src,
  name,
  className,
  width,
  height,
  style,
  fallbackStyle,
}: {
  src: string | null;
  name: string;
  className: string;
  width: number;
  height: number;
  style?: CSSProperties;
  fallbackStyle?: CSSProperties;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = (name.trim().slice(0, 1) || 'H').toUpperCase();

  if (!src || failedSrc === src) {
    return <div className={`${className} fallback`} style={fallbackStyle} aria-hidden="true">{initial}</div>;
  }

  return <Image
    className={className}
    src={src}
    alt={`${name || 'Creator'} profile photo`}
    width={width}
    height={height}
    unoptimized
    style={style}
    onError={() => setFailedSrc(src)}
  />;
}
