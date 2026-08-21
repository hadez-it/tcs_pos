import React, { useState, useMemo } from 'react';
import { Search, FileSpreadsheet, Download, Package, Printer, Edit2, PackagePlus, Trash2, ChevronLeft, ChevronRight, Filter, Building2, Layers, Plus, X } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { UserProfile, Branch, Product } from '../../types';
import SearchableCategorySelect from '../SearchableCategorySelect';
import FilterDrawer from '../FilterDrawer';

interface ProductsTabProps {
  user: UserProfile;
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  displayProducts: Product[];
  categories: string[];
  setShowCsvModal: (show: boolean) => void;
  handleExportCsv: () => void;
  openBarcodeModal: (product: Product) => void;
  startEditProduct: (product: Product) => void;
  openQuickRestock: (product: Product) => void;
  triggerDeleteProduct: (id: string, name: string) => void;
  openNewProductModal?: () => void;
}

const PRODUCTS_PER_PAGE = 20;

export default function ProductsTab({
  user,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  displayProducts,
  categories,
  setShowCsvModal,
  handleExportCsv,
  openBarcodeModal,
  startEditProduct,
  openQuickRestock,
  triggerDeleteProduct,
  openNewProductModal
}: ProductsTabProps) {
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [productPage, setProductPage] = useState(1);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (productSearch.trim()) count++;
    if (categoryFilter !== 'All') count++;
    if (stockFilter !== 'All') count++;
    if (selectedBranchId !== 'all') count++;
    return count;
  }, [productSearch, categoryFilter, stockFilter, selectedBranchId]);

  const resetFilters = () => {
    setProductSearch('');
    setCategoryFilter('All');
    setStockFilter('All');
    if (user.role !== 'manager') {
      setSelectedBranchId('all');
    }
    setProductPage(1);
  };

  const filteredProducts = useMemo(() => {
    const list = displayProducts.filter(p => {
      const matchesSearch = !productSearch.trim() ||
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                            p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
                            (p.barcode && p.barcode.toLowerCase().includes(productSearch.toLowerCase()));
      const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
      
      let matchesStock = true;
      if (stockFilter === 'Low Stock') {
        matchesStock = p.stock <= p.min_stock_level && p.stock > 0;
      } else if (stockFilter === 'Out of Stock') {
        matchesStock = p.stock === 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });

    return [...list].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });
  }, [displayProducts, productSearch, categoryFilter, stockFilter]);

  const totalProductPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE) || 1;
  const safeProductPage = Math.min(Math.max(1, productPage), totalProductPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (safeProductPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [filteredProducts, safeProductPage]);

  if (displayProducts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs w-full flex-1 flex flex-col items-center justify-center p-8 sm:p-14 text-center min-h-[380px] sm:min-h-[460px]">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5 border border-slate-200/70">
          <Package className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
          You haven't added any products yet
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 max-w-md leading-relaxed">
          Get started by creating your first product manually or importing your inventory from a CSV spreadsheet.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          {openNewProductModal && (
            <button
              type="button"
              onClick={openNewProductModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCsvModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200/80 cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-700" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full min-w-0 flex-1 flex flex-col">
      <div className="p-3.5 sm:p-5 border-b border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Name, SKU, or Barcode..."
              value={productSearch}
              onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-gray-900 shadow-2xs transition-colors"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => { setProductSearch(''); setProductPage(1); }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilterDrawer(true)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-2xs shrink-0 ${
              activeFilterCount > 0
                ? 'bg-black text-white border-black'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={() => setShowCsvModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold text-[11px] sm:text-xs rounded-xl border border-gray-200/80 transition-all cursor-pointer active:scale-95"
            title="Import inventory items from CSV file"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-900 shrink-0" />
            <span className="truncate">Import CSV</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] sm:text-xs rounded-xl border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Export current inventory list to CSV"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
            <span className="truncate">Export CSV</span>
          </button>
        </div>
      </div>

      <FilterDrawer
        isOpen={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        title="Product Filters"
        subtitle="Filter inventory by branch, category & stock"
        activeCount={activeFilterCount}
        onReset={resetFilters}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Search Keyword</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Product name, SKU, barcode..."
                value={productSearch}
                onChange={(e) => { setProductSearch(e.target.value); setProductPage(1); }}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-black focus:bg-white"
              />
            </div>
          </div>

          {branches.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Branch
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setProductPage(1); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium text-slate-800 text-xs focus:outline-none focus:border-black focus:bg-white cursor-pointer"
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Category
            </label>
            <SearchableCategorySelect
              options={categories.map(cat => ({
                value: cat,
                label: cat,
                count: cat === 'All' ? displayProducts.length : displayProducts.filter(p => p.category === cat).length
              }))}
              value={categoryFilter}
              onChange={(val) => { setCategoryFilter(val); setProductPage(1); }}
              className="w-full"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-slate-400" /> Stock Status
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { val: 'All', label: 'All Stock Levels' },
                { val: 'Low Stock', label: 'Low Stock Warnings' },
                { val: 'Out of Stock', label: 'Out of Stock Only' }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => { setStockFilter(opt.val); setProductPage(1); }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-left flex items-center justify-between ${
                    stockFilter === opt.val
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </FilterDrawer>

      {/* Product Table & Mobile Cards */}
      <div className="p-0 flex-1 flex flex-col">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 text-xs flex flex-col items-center justify-center gap-2.5 flex-1 min-h-[280px]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-1 border border-slate-200/60">
              <Search className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-slate-900 text-sm">No Matching Products Found</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              No inventory products found matching your search or filters.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-2.5 sm:hidden p-3 bg-slate-50/50">
              {paginatedProducts.map((prod) => {
                const isLowStock = prod.stock <= prod.min_stock_level;
                const isOutOfStock = prod.stock === 0;

                return (
                  <div 
                    key={prod.id} 
                    className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {prod.image ? (
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200/80 shrink-0 bg-slate-50" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="font-bold text-slate-950 text-xs truncate" title={prod.name}>
                            {prod.name}
                          </h4>
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-semibold text-slate-600 shrink-0">
                            {prod.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                          <span className="font-mono font-bold text-slate-900">{formatCurrency(prod.price)}</span>
                          <span className="text-slate-300">•</span>
                          <span className={`font-mono font-bold text-[10px] ${
                            isOutOfStock ? 'text-red-600' : isLowStock ? 'text-slate-700' : 'text-slate-600'
                          }`}>
                            {prod.stock} {prod.unit_name || 'ခု'} {isOutOfStock ? '(Out)' : isLowStock ? '(Low)' : ''}
                          </span>
                        </div>

                        {(prod.barcode || prod.sku) && (
                          <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">
                            {prod.barcode ? `BC: ${prod.barcode}` : `SKU: ${prod.sku}`}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400">Cost:</span>
                        <span className="font-mono text-slate-600 font-medium">{formatCurrency(prod.cost)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openBarcodeModal(prod)}
                          className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200/80 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          title="Print Barcode Label"
                          aria-label={`Barcode for ${prod.name}`}
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-600" />
                          <span className="hidden xs:inline">Barcode</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openQuickRestock(prod)}
                          className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200/80 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          title="Quick Restock"
                          aria-label={`Restock ${prod.name}`}
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-slate-600" />
                          <span className="hidden xs:inline">Restock</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => startEditProduct(prod)}
                          className="px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-lg border border-slate-200/80 transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          title="Edit Product"
                          aria-label={`Edit ${prod.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => triggerDeleteProduct(prod.id, prod.name)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200/60 transition-colors flex items-center text-[10px] font-bold cursor-pointer"
                          title="Delete Product"
                          aria-label={`Delete ${prod.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Spreadsheet Table View */}
            <div className="hidden sm:block w-full max-w-full overflow-x-auto border-t border-slate-200">
              <table className="w-full text-left text-xs border-collapse font-sans min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase font-bold text-[10px] tracking-wider sticky top-0 z-10">
                    <th className="p-2.5 border-r border-slate-200 w-52 min-w-[180px] max-w-[240px]">Name</th>
                    <th className="p-2.5 border-r border-slate-200 w-44 min-w-[150px] max-w-[200px]">Description</th>
                    <th className="p-2.5 border-r border-slate-200 w-28 min-w-[100px]">Category</th>
                    <th className="p-2.5 border-r border-slate-200 w-32 text-right">Purchased Price</th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">Unit Amount</th>
                    <th className="p-2.5 border-r border-slate-200 w-32 text-right">Unit Price</th>
                    <th className="p-2.5 border-r border-slate-200 w-24 text-center">Unit Name</th>
                    <th className="p-2.5 border-r border-slate-200 w-20 text-center">Stock</th>
                    <th className="p-2.5 border-r border-slate-200 w-28">Price Variant</th>
                    <th className="p-2.5 border-r border-slate-200 w-28">Expiry Date</th>
                    <th className="p-2.5 border-r border-slate-200 w-32">Barcode</th>
                    <th className="p-2.5 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedProducts.map((prod) => {
                    const isLowStock = prod.stock <= prod.min_stock_level;
                    const isOutOfStock = prod.stock === 0;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50 transition-colors">
                        {/* Name */}
                        <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100 max-w-[240px]">
                          <div className="flex items-center gap-2 min-w-0">
                            {prod.image ? (
                              <img src={prod.image} alt={prod.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                            <span className="truncate font-bold text-slate-900" title={prod.name}>{prod.name}</span>
                          </div>
                        </td>

                        {/* Description */}
                        <td className="p-3 text-slate-600 border-r border-slate-100 truncate max-w-[160px]" title={prod.description}>
                          {prod.description || '-'}
                        </td>

                        {/* Category */}
                        <td className="p-3 border-r border-slate-100 font-semibold text-slate-700">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                            {prod.category}
                          </span>
                        </td>

                        {/* Purchased Price */}
                        <td className="p-3 text-right font-mono text-slate-600 border-r border-slate-100 font-medium">
                          {prod.cost ? prod.cost.toLocaleString() : '0'}
                        </td>

                        {/* Unit Amount */}
                        <td className="p-3 text-center font-mono text-slate-700 border-r border-slate-100">
                          {prod.unit_amount || 1}
                        </td>

                        {/* Unit Price */}
                        <td className="p-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
                          {prod.price ? prod.price.toLocaleString() : '0'}
                        </td>

                        {/* Unit Name */}
                        <td className="p-3 text-center font-bold text-gray-900 border-r border-slate-100">
                          {prod.unit_name || 'ခု'}
                        </td>

                        {/* Stock */}
                        <td className="p-3 text-center border-r border-slate-100">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                            isOutOfStock 
                              ? 'bg-red-100 text-red-800' 
                              : isLowStock 
                                ? 'bg-gray-100 text-gray-900' 
                                : 'bg-gray-100 text-gray-900'
                          }`}>
                            {prod.stock}
                          </span>
                        </td>

                        {/* Price Variant */}
                        <td className="p-3 text-slate-500 border-r border-slate-100">
                          {prod.price_variant || '-'}
                        </td>

                        {/* Expiry Date */}
                        <td className="p-3 text-slate-500 border-r border-slate-100">
                          {prod.expiry_date || '-'}
                        </td>

                        {/* Barcode */}
                        <td className="p-3 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                          {prod.barcode || '-'}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => openBarcodeModal(prod)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded transition-colors cursor-pointer"
                              title="Print Barcode Label"
                            >
                              <Printer className="w-3.5 h-3.5 text-gray-900" />
                            </button>
                            <button
                              onClick={() => startEditProduct(prod)}
                              className="p-1.5 hover:bg-gray-50 text-gray-900 hover:text-gray-900 rounded transition-colors cursor-pointer"
                              title="Edit Details & Adjust Stock"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openQuickRestock(prod)}
                              className="p-1.5 hover:bg-gray-50 text-gray-900 hover:text-gray-900 rounded transition-colors cursor-pointer"
                              title="Quick Restock"
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => triggerDeleteProduct(prod.id, prod.name)}
                              className="p-1.5 hover:bg-red-50 text-red-600 hover:text-red-800 rounded transition-colors cursor-pointer"
                              title="Delete Product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {totalProductPages > 1 && (
              <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 font-medium text-center sm:text-left">
                  Showing <span className="font-bold text-slate-800">{((safeProductPage - 1) * PRODUCTS_PER_PAGE) + 1}</span> to <span className="font-bold text-slate-800">{Math.min(safeProductPage * PRODUCTS_PER_PAGE, filteredProducts.length)}</span> of <span className="font-bold text-slate-800">{filteredProducts.length}</span> products
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={safeProductPage === 1}
                    onClick={() => setProductPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalProductPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalProductPages || Math.abs(p - safeProductPage) <= 1)
                      .reduce<(number | string)[]>((acc, page, idx, arr) => {
                        if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                          acc.push('...');
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, idx) => (
                        typeof item === 'number' ? (
                          <button
                            key={idx}
                            onClick={() => setProductPage(item)}
                            className={`w-8 h-8 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              safeProductPage === item
                                ? 'bg-black text-white shadow-xs'
                                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs'
                            }`}
                          >
                            {item}
                          </button>
                        ) : (
                          <span key={idx} className="px-1 text-slate-400 font-bold">...</span>
                        )
                      ))
                    }
                  </div>

                  <button
                    disabled={safeProductPage >= totalProductPages}
                    onClick={() => setProductPage(p => Math.min(totalProductPages, p + 1))}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
