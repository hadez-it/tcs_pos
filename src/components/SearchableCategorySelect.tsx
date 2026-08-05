import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Filter, Search, ChevronDown, Check, X, Plus } from 'lucide-react';

export interface CategoryOption {
  value: string;
  label?: string;
  count?: number;
}

interface SearchableCategorySelectProps {
  options: (string | CategoryOption)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allLabel?: string;
  allowCreate?: boolean;
  createPlaceholder?: string;
}

export const SearchableCategorySelect: React.FC<SearchableCategorySelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select Category...',
  className = '',
  allLabel,
  allowCreate = true,
  createPlaceholder = 'Create new category...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const parsedOptions: CategoryOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setCreatingNew(false);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      e.preventDefault();
      if (allowCreate) {
        const exactMatch = parsedOptions.find(
          opt => opt.value.toLowerCase() === searchQuery.trim().toLowerCase()
        );

        if (!exactMatch) {
          // Create new category
          setCreatingNew(true);
          onChange(searchQuery.trim());
          setIsOpen(false);
          setSearchQuery('');
        } else {
          // Select exact match
          onChange(exactMatch.value);
          setIsOpen(false);
          setSearchQuery('');
        }
      }
    }
  }, [searchQuery, allowCreate, onChange, parsedOptions]);

  const filteredOptions = parsedOptions.filter((opt) => {
    const textToMatch = (opt.label || opt.value).toLowerCase();
    return textToMatch.includes(searchQuery.toLowerCase().trim());
  });

  const selectedOption = parsedOptions.find((opt) => opt.value === value);

  const displaySelectedText = selectedOption
    ? selectedOption.label || selectedOption.value
    : value || placeholder;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 hover:border-indigo-400 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-sm flex items-center justify-between cursor-pointer transition-all"
      >
        <Filter className="absolute inset-y-0 left-0 pl-3 w-4 h-4 my-auto text-indigo-600 pointer-events-none" />
        <span className="truncate pr-2 text-left">
          {displaySelectedText}
          {selectedOption && selectedOption.count !== undefined && (
            <span className="text-slate-400 font-normal ml-1">({selectedOption.count})</span>
          )}
        </span>
        <ChevronDown className={`absolute inset-y-0 right-0 pr-2.5 w-4 h-4 my-auto text-slate-400 pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-premium-lg overflow-hidden animate-scale-in min-w-[200px]">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={creatingNew ? createPlaceholder : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                autoComplete="off"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {creatingNew && (
                <button
                  type="button"
                  onClick={() => {
                    if (searchQuery.trim() !== '') {
                      onChange(searchQuery.trim());
                      setIsOpen(false);
                      setCreatingNew(false);
                      setSearchQuery('');
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-800 p-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 && !creatingNew ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400 font-medium">
                No matches
                {allowCreate && searchQuery.trim() !== '' && (
                  <div className="mt-2 text-xs font-medium text-indigo-600 cursor-pointer hover:text-indigo-800" onClick={() => {
                    setCreatingNew(true);
                    searchInputRef.current?.focus();
                  }}>
                    Create "{searchQuery}" →
                  </div>
                )}
              </div>
            ) : (
              <>
                {filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setCreatingNew(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="truncate">
                        {opt.label || opt.value}
                      </span>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {opt.count !== undefined && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            isSelected ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {opt.count}
                          </span>
                        )}
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })}
                {allowCreate && !creatingNew && searchQuery.trim() !== '' && (
                  <button
                    type="button"
                    onClick={() => setCreatingNew(true)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-all cursor-pointer text-indigo-600 hover:bg-indigo-50 hover:text-white"
                  >
                    <span className="truncate">
                      Create "{searchQuery}"
                    </span>
                    <span className="ml-2">
                      <Plus className="w-4 h-4" />
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableCategorySelect;
