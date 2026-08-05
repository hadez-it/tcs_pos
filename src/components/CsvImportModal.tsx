import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, Download, CheckCircle, AlertCircle, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { useToast } from '../utils/toast';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (products: Partial<Product>[], branchId: string, branchName: string) => Promise<void>;
  branches: Array<{ id: string; name: string; code: string }>;
  defaultBranchId: string;
  defaultBranchName: string;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  branches,
  defaultBranchId,
  defaultBranchName,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<Partial<Product>[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [selectedBranchName, setSelectedBranchName] = useState<string>(defaultBranchName);

  const { toast } = useToast();

  if (!isOpen) return null;

  // Function to parse CSV text into JS objects safely
  const parseCSV = (csvText: string): Partial<Product>[] => {
    const lines = csvText.split(/\r\n|\n/);
    if (lines.length < 2) {
      throw new Error('CSV file is empty or missing data rows.');
    }

    // Split CSV line respecting quoted strings
    const splitCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(s => s.replace(/^["']|["']$/g, '').trim());
    };

    const rawHeaders = splitCSVLine(lines[0]);
    // Clean and normalize headers
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const items: Partial<Product>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue; // Skip empty lines

      const values = splitCSVLine(lineStr);
      const rowObj: Record<string, string> = {};

      rawHeaders.forEach((origHeader, idx) => {
        const key = headers[idx] || `col_${idx}`;
        rowObj[key] = values[idx] !== undefined ? values[idx] : '';
        rowObj[origHeader.toLowerCase().trim()] = values[idx] !== undefined ? values[idx] : '';
      });

      // Helper to extract value by multiple possible header keys
      const getVal = (...keys: string[]): string => {
        for (const k of keys) {
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (rowObj[normKey] !== undefined && rowObj[normKey] !== '') {
            return rowObj[normKey];
          }
          if (rowObj[k.toLowerCase()] !== undefined && rowObj[k.toLowerCase()] !== '') {
            return rowObj[k.toLowerCase()];
          }
        }
        return '';
      };

      const name = getVal('name', 'product name', 'item name', 'product');
      if (!name) continue; // skip rows without name

      const id = getVal('id', 'sku', 'code') || Math.random().toString(36).substring(2, 12);
      const image = getVal('image', 'img', 'photo') || null;
      const description = getVal('description', 'desc', 'details') || '';
      const category = getVal('category', 'cat', 'group') || 'General';
      const useStockRaw = getVal('usestock', 'use stock', 'stock tracking');
      const useStock = useStockRaw === '' ? true : useStockRaw.toLowerCase() === 'true' || useStockRaw === '1';

      const purchasedPriceStr = getVal('purchasedprice', 'purchased price', 'cost', 'cost price', 'purchase price');
      const cost = parseFloat(purchasedPriceStr.replace(/[^0-9.]/g, '')) || 0;

      const unitAmountStr = getVal('unitamount', 'unit amount', 'qty per unit');
      const unitAmount = parseFloat(unitAmountStr.replace(/[^0-9.]/g, '')) || 1;

      const unitPriceStr = getVal('unitprice', 'unit price', 'price', 'selling price');
      const price = parseFloat(unitPriceStr.replace(/[^0-9.]/g, '')) || 0;

      const unitName = getVal('unitname', 'unit name', 'unit', 'uom') || 'ခု';

      const stockStr = getVal('stock', 'stock count', 'quantity', 'qty');
      const stock = parseInt(stockStr.replace(/[^0-9-]/g, ''), 10) || 0;

      const priceVariant = getVal('pricevariant', 'price variant', 'variant');
      const expiryDate = getVal('expirydate', 'expiry date', 'exp date', 'expiry');
      const updatedDate = getVal('updateddate', 'updated date', 'updated at') || new Date().toLocaleString();
      const barcode = getVal('barcode', 'bar code', 'upc', 'ean') || id;

      items.push({
        id,
        sku: id,
        name,
        image: image === 'null' ? null : image,
        description,
        category,
        use_stock: useStock,
        cost,
        unit_amount: unitAmount,
        price,
        unit_name: unitName,
        stock,
        min_stock_level: 5,
        price_variant: priceVariant,
        expiry_date: expiryDate,
        updated_at: updatedDate,
        barcode,
        created_at: new Date().toISOString()
      });
    }

    return items;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = (fileToRead: File) => {
    setFile(fileToRead);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const items = parseCSV(text);
        if (items.length === 0) {
          setErrorMsg('No valid product rows were found in the CSV file.');
          toast('No valid product rows were found in the CSV file.', 'error');
          setParsedItems([]);
        } else {
          setParsedItems(items);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error parsing CSV file format.');
        toast(err.message || 'Error parsing CSV file format.', 'error');
        setParsedItems([]);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read the selected file.');
      toast('Failed to read the selected file.', 'error');
    };
    reader.readAsText(fileToRead, 'UTF-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.txt'))) {
      processFile(droppedFile);
    } else {
      setErrorMsg('Please upload a valid .csv file.');
      toast('Please upload a valid .csv file.', 'error');
    }
  };

  const handleConfirmImport = async () => {
    if (parsedItems.length === 0 || isProcessing) return;
    if (!selectedBranchId) {
      setErrorMsg('Please select a branch before importing.');
      toast('Please select a branch before importing.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await onImportSuccess(parsedItems, selectedBranchId, selectedBranchName);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Failed to import items into inventory.');
      toast(err.message || 'Failed to import items into inventory.', 'error');
    }
  };

  // Download Sample CSV file matching user's screenshot format
  const handleDownloadSampleCsv = () => {
    const csvContent = 
`ID,Name,Image,Description,Category,Use Stock,Purchased Price,Unit Amount,Unit Price,Unit Name,Stock,Price Variant,Expiry Date,Updated Date,Barcode
706ikmnn872toh,Nova ရိုတ်စက်,null,ဆိပ်ညှပ်စက်,ST,true,25000,1,35000,ခု,3,,,02:14:03 PM 22/07/2026,
m6eoqizkd5cek9,ခွက်ရိုက်ဘက်တံ,null,ခွက်ရိုက်ဘက်တံ,ST,true,25000,1,33000,ခု,5,,,01:58:49 PM 22/07/2026,
6cx3wkj19i5w3v,Saga ခွက်ရိုက်ဘက်တံ,null,ခြံရိုက်ဘက်တံ,ST,true,28000,1,38000,ခု,5,,,01:57:54 PM 22/07/2026,
lmo5ud6uyktfw6,MILL 27W C to lp,null,အားသွင်းကြိုး,KWT,true,4000,1,10000,ကြိုး,5,,,10:45:25 AM 21/07/2026,6971604616598
enr7i62p8dwq4u,kailidi D20 135w ကြိုးခေါင်း,null,အားသွင်းကြိုး,KWT,true,6900,1,12000,ကြိုး,10,,,10:30:30 AM 21/07/2026,73995396939
06qayhc5xubvqt,R 37 135W QC,null,အားသွင်းကြိုး,KWT,true,8200,1,20000,ကြိုး,10,,,10:15:08 AM 21/07/2026,6920702726982
gamdvdstpnrqlk,R33 135w QC Adaptor ခေါင်းလွတ်,null,အားသွင်းကြိုး,KWT,true,6100,1,15000,ကြိုး,10,,,10:08:07 AM 21/07/2026,6920702726982`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inventory_template_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                Import Inventory Items from CSV
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Upload your inventory spreadsheet file (.csv) with Myanmar text & product data
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadSampleCsv}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download Sample CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* BRANCH SELECTOR */}
          <div className="flex items-center space-x-3">
            <label className="text-xs font-extrabold text-slate-700 whitespace-nowrap">Branch <span className="text-red-500">*</span>:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                const b = branches.find(b => b.id === e.target.value);
                setSelectedBranchId(e.target.value);
                setSelectedBranchName(b?.name || e.target.value);
              }}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="" disabled>Select a branch to import into...</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          {/* UPLOAD ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50/50 scale-[1.005]'
                : file
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className="cursor-pointer block">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-extrabold text-slate-900 text-sm mb-1">
                {file ? file.name : 'Click to select CSV file or drag & drop here'}
              </p>
              <p className="text-xs text-slate-500">
                Supports columns: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">ID, Name, Image, Description, Category, Use Stock, Purchased Price, Unit Amount, Unit Price, Unit Name, Stock, Barcode</code>
              </p>
            </label>
          </div>

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PREVIEW TABLE */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Parsed {parsedItems.length} Products for Import</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Review items below before saving to inventory
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[320px] overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-sans min-w-[1200px]">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10">
                      <th className="p-2.5 border-r border-slate-200">ID</th>
                      <th className="p-2.5 border-r border-slate-200">Name</th>
                      <th className="p-2.5 border-r border-slate-200">Image</th>
                      <th className="p-2.5 border-r border-slate-200">Description</th>
                      <th className="p-2.5 border-r border-slate-200">Category</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">Use Stock</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">Purchased Price</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">Unit Amount</th>
                      <th className="p-2.5 border-r border-slate-200 text-right">Unit Price</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">Unit Name</th>
                      <th className="p-2.5 border-r border-slate-200 text-center">Stock</th>
                      <th className="p-2.5 border-r border-slate-200">Price Variant</th>
                      <th className="p-2.5 border-r border-slate-200">Expiry Date</th>
                      <th className="p-2.5 border-r border-slate-200">Updated Date</th>
                      <th className="p-2.5">Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-mono text-slate-600 border-r border-slate-100 truncate max-w-[120px]">{item.id}</td>
                        <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">{item.name}</td>
                        <td className="p-2.5 text-slate-400 border-r border-slate-100 text-center">{item.image || 'null'}</td>
                        <td className="p-2.5 text-slate-600 border-r border-slate-100 truncate max-w-[150px]">{item.description || '-'}</td>
                        <td className="p-2.5 text-slate-700 border-r border-slate-100 font-semibold">{item.category}</td>
                        <td className="p-2.5 text-center border-r border-slate-100 font-mono text-[10px]">
                          <span className={item.use_stock ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                            {item.use_stock ? 'true' : 'false'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-600 border-r border-slate-100">{item.cost}</td>
                        <td className="p-2.5 text-center font-mono border-r border-slate-100">{item.unit_amount || 1}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 border-r border-slate-100">{item.price}</td>
                        <td className="p-2.5 text-center font-bold text-indigo-700 border-r border-slate-100">{item.unit_name}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-700 border-r border-slate-100">{item.stock}</td>
                        <td className="p-2.5 text-slate-500 border-r border-slate-100">{item.price_variant || '-'}</td>
                        <td className="p-2.5 text-slate-500 border-r border-slate-100">{item.expiry_date || '-'}</td>
                        <td className="p-2.5 text-slate-500 border-r border-slate-100 whitespace-nowrap">{item.updated_at || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-600">{item.barcode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">
            Total Valid Items: <strong className="text-slate-900 font-bold">{parsedItems.length}</strong>
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={parsedItems.length === 0 || isProcessing || !selectedBranchId}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import {parsedItems.length} Products</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CsvImportModal;
