import React from 'react';
import { TextureFilterType } from '../types/erp';

export function getFilterUrl(texture: TextureFilterType): string | undefined {
  switch (texture) {
    case 'rough-brush':
      return 'url(#tex-rough-brush)';
    case 'ink-porosity':
      return 'url(#tex-ink-porosity)';
    case 'cyanotype':
      return 'url(#tex-cyanotype)';
    case 'materic-blob':
      return 'url(#tex-materic-blob)';
    default:
      return undefined;
  }
}

export const SvgTextureDefs: React.FC = () => {
  return (
    <defs>
      {/* Pattern grana carta Kraft naturale di fondo */}
      <pattern id="kraft-paper-grain" width="120" height="120" patternUnits="userSpaceOnUse">
        <circle cx="18" cy="24" r="0.9" fill="#1A2B4C" fillOpacity="0.06" />
        <circle cx="74" cy="16" r="1.2" fill="#B85B43" fillOpacity="0.07" />
        <circle cx="42" cy="68" r="0.8" fill="#4A6B53" fillOpacity="0.06" />
        <circle cx="96" cy="82" r="1.1" fill="#1A2B4C" fillOpacity="0.05" />
        <circle cx="28" cy="104" r="1.0" fill="#B85B43" fillOpacity="0.06" />
        <path
          d="M 55 40 Q 60 38 64 42"
          stroke="#1A2B4C"
          strokeWidth="0.6"
          strokeOpacity="0.05"
          fill="none"
        />
        <path
          d="M 12 85 Q 16 88 21 84"
          stroke="#B85B43"
          strokeWidth="0.6"
          strokeOpacity="0.06"
          fill="none"
        />
      </pattern>

      {/* 1. Pennellata Ruvida (Dry Brush / Rough Edge Displacement) */}
      <filter id="tex-rough-brush" x="-12%" y="-12%" width="124%" height="124%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.045 0.08"
          numOctaves="3"
          seed="7"
          result="noise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="noise"
          scale="6.5"
          xChannelSelector="R"
          yChannelSelector="G"
          result="displaced"
        />
      </filter>

      {/* 2. Porosità dell'Inchiostro (Timbro / Stampa tipografica artigianale) */}
      <filter id="tex-ink-porosity" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.18"
          numOctaves="4"
          seed="14"
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 1.45 -0.18"
          result="porousMask"
        />
        <feComposite in="SourceGraphic" in2="porousMask" operator="in" result="textured" />
        <feDisplacementMap
          in="textured"
          in2="grain"
          scale="2.2"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>

      {/* 3. Effetto Cianotipia (Viraggio Blu di Prussia solare + grana cotone) */}
      <filter id="tex-cyanotype" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.09"
          numOctaves="3"
          seed="21"
          result="uvGrain"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="uvGrain"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="B"
          result="roughened"
        />
        <feColorMatrix
          in="roughened"
          type="matrix"
          values="0.12 0.05 0.05 0 0.06
                  0.10 0.24 0.18 0 0.12
                  0.22 0.35 0.55 0 0.24
                  0    0    0    1 0"
        />
      </filter>

      {/* 4. Riempimento Materico Blob (Bordo organico morbido e pastoso) */}
      <filter id="tex-materic-blob" x="-15%" y="-15%" width="130%" height="130%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.025"
          numOctaves="2"
          seed="3"
          result="blobNoise"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="blobNoise"
          scale="9"
          xChannelSelector="R"
          yChannelSelector="G"
          result="organicShape"
        />
      </filter>
    </defs>
  );
};
