'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export function ArticleThumbnail({ src, alt }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-24 h-16 sm:w-28 sm:h-20 shrink-0 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
        <ImageOff className="text-slate-600" size={20} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-24 h-16 sm:w-28 sm:h-20 shrink-0 rounded-lg object-cover border border-slate-700/50 bg-slate-800/50"
    />
  );
}
