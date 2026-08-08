import { LabelConfig } from '../types';

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  paperMode: 'sticker',
  paperWidth: '80',
  labelWidth: '80',
  labelHeight: '30',
  barcodeWidth: '80',
  barcodeHeight: '10',
  barcodeType: 'CODE39',
  cutMode: 'off',
  labelGap: '3',
  feedOffset: '0',
  showStoreName: true,
  showProductName: true,
  showPrice: true,
  showCodeText: true,
  storeName: 'My Retail Store',
  customLayout: false,
  layoutXY: {
    store: { x: '0', y: '0' },
    product: { x: '0', y: '6' },
    barcode: { x: '0', y: '12' },
    price: { x: '0', y: '24' },
  },
  fontSize: {
    store: 1,
    product: 1,
    price: 2,
  },
};

const STORAGE_KEY = 'retail_shop_label_config';

export function loadLabelConfig(defaultStoreName?: string): LabelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_LABEL_CONFIG,
        ...parsed,
        storeName: parsed.storeName || defaultStoreName || DEFAULT_LABEL_CONFIG.storeName,
        layoutXY: {
          ...DEFAULT_LABEL_CONFIG.layoutXY,
          ...(parsed.layoutXY || {}),
        },
        fontSize: {
          ...DEFAULT_LABEL_CONFIG.fontSize,
          ...(parsed.fontSize || {}),
        },
      };
    }
  } catch (err) {}
  return {
    ...DEFAULT_LABEL_CONFIG,
    storeName: defaultStoreName || DEFAULT_LABEL_CONFIG.storeName,
  };
}

export function saveLabelConfig(config: LabelConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {}
}
