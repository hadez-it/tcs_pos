import React from 'react';

interface BarcodeSVGProps {
  value: string;
  width?: number;
  height?: number;
  showValue?: boolean;
  className?: string;
}

// Code 39 Barcode character patterns (n = narrow bar 1 unit, w = wide bar 3 units)
// Each character consists of 9 elements (5 bars, 4 spaces)
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  'A': 'wnnnnwnnw',
  'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn',
  'D': 'nnnnwwnnw',
  'E': 'wnnnwwnnn',
  'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw',
  'H': 'wnnnnwwnn',
  'I': 'nnwnnwwnn',
  'J': 'nnnnwwwnn',
  'K': 'wnnnnnnnw',
  'L': 'nnwnnnnnw',
  'M': 'wnwnnnnnn',
  'N': 'nnnnwnnnw',
  'O': 'wnnnwnnnn',
  'P': 'nnwnwnnnn',
  'Q': 'nnnnnnwnw',
  'R': 'wnnnnnwnn',
  'S': 'nnwnnnwnn',
  'T': 'nnnnwnwnn',
  'U': 'wwnnnnnnw',
  'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn',
  'X': 'nwnnwnnnw',
  'Y': 'wwnnwnnnn',
  'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwwwnn', // Start/Stop asterisk
};

export const BarcodeSVG: React.FC<BarcodeSVGProps> = ({
  value,
  height = 50,
  showValue = true,
  className = '',
}) => {
  const cleanVal = (value || '000000').toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  const barcodeStr = `*${cleanVal || '000000'}*`;

  // Calculate total units
  // Wide bar = 3 units, Narrow bar = 1 unit
  // Inter-character space = 1 unit narrow
  let totalUnits = 0;
  const elements: Array<{ isBar: boolean; widthUnits: number }> = [];

  for (let i = 0; i < barcodeStr.length; i++) {
    const char = barcodeStr[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['0'];

    for (let p = 0; p < pattern.length; p++) {
      const isBar = p % 2 === 0;
      const widthUnits = pattern[p] === 'w' ? 3 : 1;
      elements.push({ isBar, widthUnits });
      totalUnits += widthUnits;
    }

    // Add inter-character gap (narrow space = 1 unit) if not last char
    if (i < barcodeStr.length - 1) {
      elements.push({ isBar: false, widthUnits: 1 });
      totalUnits += 1;
    }
  }

  // Quiet zones on left & right (10 units each)
  const quietZone = 10;
  const fullWidth = totalUnits + quietZone * 2;

  let currentX = quietZone;
  const rects: React.ReactNode[] = [];

  elements.forEach((el, idx) => {
    if (el.isBar) {
      rects.push(
        <rect
          key={idx}
          x={currentX}
          y={0}
          width={el.widthUnits}
          height={height}
          fill="#000000"
        />
      );
    }
    currentX += el.widthUnits;
  });

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${fullWidth} ${height}`}
        className="w-full h-auto max-h-[60px]"
        preserveAspectRatio="none"
      >
        {rects}
      </svg>
      {showValue && (
        <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-800 tracking-widest mt-0.5">
          {cleanVal}
        </span>
      )}
    </div>
  );
};

export default BarcodeSVG;
