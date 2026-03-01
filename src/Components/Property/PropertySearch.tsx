import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Package, MapPin } from 'lucide-react'
import type { PropertySearchResult } from '../../Types/PropertyTypes'

interface PropertySearchProps {
  onSearch: (query: string) => Promise<PropertySearchResult[]>
  onSelectItem: (id: string) => void
  onSelectLocation: (id: string) => void
}

export function PropertySearch({ onSearch, onSelectItem, onSelectLocation }: PropertySearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PropertySearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      const r = await onSearch(value)
      setResults(r)
      setIsSearching(false)
    }, 300)
  }, [onSearch])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  return (
    <div className="flex flex-col">
      <div className="relative px-4 py-2">
        <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search items, NSN, serial..."
          className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-tertiary/20 bg-themewhite text-primary placeholder:text-tertiary/50 focus:outline-none focus:border-themeblue3/50 focus:ring-1 focus:ring-themeblue3/20 transition-colors"
        />
        {query && (
          <button
            className="absolute right-7 top-1/2 -translate-y-1/2 text-tertiary hover:text-primary"
            onClick={() => { setQuery(''); setResults([]) }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isSearching && (
        <div className="px-4 py-3 text-xs text-tertiary">Searching...</div>
      )}

      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/5 active:bg-secondary/10 transition-colors border-b border-tertiary/5"
              onClick={() => r.type === 'item' ? onSelectItem(r.id) : onSelectLocation(r.id)}
            >
              {r.type === 'item' ? (
                <Package size={14} className="text-themeblue3 shrink-0" />
              ) : (
                <MapPin size={14} className="text-green-600 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-sm text-primary truncate block">{r.name}</span>
                {r.detail && <span className="text-xs text-tertiary">{r.detail}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {query && !isSearching && results.length === 0 && (
        <div className="px-4 py-3 text-xs text-tertiary">No results found</div>
      )}
    </div>
  )
}
