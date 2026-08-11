import React from 'react';

interface BarcodeSVGProps {
  value: string;
  width?: number;
  height?: number;
  showValue?: boolean;
  className?: string;
}

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export const BarcodeSVG: React.FC<BarcodeSVGProps> = ({
  value,
  height = 50,
  showValue = true,
  className = '',
}) => {
  const cleanVal = (value || '000000').replace(/[^ -~]/g, '');
  const displayVal = cleanVal || '000000';

  const symbols: number[] = [104];
  let checksum = 104;

  for (let i = 0; i < displayVal.length; i++) {
    const code = displayVal.charCodeAt(i);
    const val = code >= 32 && code <= 126 ? code - 32 : 0;
    symbols.push(val);
    checksum += (i + 1) * val;
  }

  symbols.push(checksum % 103);
  symbols.push(106);

  let totalUnits = 0;
  const elements: Array<{ isBar: boolean; widthUnits: number }> = [];

  symbols.forEach(symIdx => {
    const pat = CODE128_PATTERNS[symIdx] || CODE128_PATTERNS[0];
    for (let p = 0; p < pat.length; p++) {
      const isBar = p % 2 === 0;
      const widthUnits = parseInt(pat[p], 10);
      elements.push({ isBar, widthUnits });
      totalUnits += widthUnits;
    }
  });

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
          {displayVal}
        </span>
      )}
    </div>
  );
};

export default BarcodeSVG;

