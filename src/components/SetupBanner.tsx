import { useState } from 'react';
import { Database, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { SUPABASE_SCHEMA_SQL } from '../data/schemaSql';

export default function SetupBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isSupabaseConfigured) return null;

  const sqlSchema = SUPABASE_SCHEMA_SQL;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 text-gray-900 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start md:items-center space-x-3">
            <div className="bg-gray-100 p-2 rounded-lg text-gray-900 mt-0.5 md:mt-0 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Running in Local Demo Mode (LocalStorage Database)
              </p>
              <p className="text-xs text-gray-900 mt-0.5">
                The application is fully interactive and persistent in your browser. Connect to a live Supabase database for production hosting.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-900 transition-colors"
            >
              <span>{isOpen ? 'Hide Setup SQL Guide' : 'Show Supabase SQL Setup Guide'}</span>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-gray-900 flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-gray-900" />
                  <span>How to connect your live Supabase database:</span>
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-900">
                  <li>
                    Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-gray-900">supabase.com</a>.
                  </li>
                  <li>
                    Go to your **SQL Editor** in Supabase and paste the database schema schema on the right.
                  </li>
                  <li>
                    Create initial user login profiles (matching owner/cashier roles) in your Supabase database <code>profiles</code> table.
                  </li>
                  <li>
                    Declare the environment variables on Vercel or in your <code>.env</code> settings:
                    <div className="bg-gray-100 p-2 rounded mt-1.5 font-mono text-[10px] text-gray-900 select-all border border-gray-200">
                      VITE_SUPABASE_URL=your_supabase_url<br />
                      VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
                    </div>
                  </li>
                </ol>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">Database Setup SQL Schema:</span>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-black hover:bg-gray-800 text-white font-medium text-[11px] transition-colors shadow-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Schema</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-black text-gray-300 p-3 rounded-lg font-mono text-[10px] overflow-x-auto max-h-56 leading-relaxed border border-gray-900 shadow-inner">
                  {sqlSchema}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
