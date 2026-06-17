import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { Search, Plus, FileText, Clock, CheckCircle, XCircle, ChevronRight, ChevronLeft, User } from 'lucide-react'

const ITEMS_PER_PAGE = 20

interface Quote {
  id: string
  reference: string
  client_name: string | null
  project_name: string | null
  surface_type: string
  floor_area: number
  wall_area: number
  subtotal: number
  vat: number
  total: number
  status: string
  created_by: string | null
  created_at: string
  updated_at: string
  creator_name?: string
  creator_email?: string
}

export function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [creatorFilter, setCreatorFilter] = useState<string>('all')
  const [creators, setCreators] = useState<{id: string, name: string}[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const navigate = useNavigate()
  const { profile } = useAuth()

  useEffect(() => {
    fetchQuotes()
  }, [])

  async function fetchQuotes() {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching quotes:', error)
    } else {
      // Get creator info for each quote
      const quotesWithCreators = await Promise.all((data || []).map(async (quote) => {
        if (quote.created_by) {
          const { data: creatorData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', quote.created_by)
            .single()
          
          if (creatorData) {
            quote.creator_name = creatorData.full_name
            quote.creator_email = creatorData.email
          }
        }
        return quote
      }))

      setQuotes(quotesWithCreators)

      // Build unique creators list for filter
      const uniqueCreators = [...new Set(quotesWithCreators.filter(q => q.creator_name).map(q => JSON.stringify({id: q.created_by, name: q.creator_name})))]
        .map(s => JSON.parse(s))
      setCreators(uniqueCreators)
    }
    setLoading(false)
  }

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.reference.toLowerCase().includes(search.toLowerCase()) ||
      (q.client_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (q.project_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (q.creator_name?.toLowerCase() || '').includes(search.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter
    const matchesCreator = creatorFilter === 'all' || q.created_by === creatorFilter
    
    return matchesSearch && matchesStatus && matchesCreator
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, creatorFilter])

  // Pagination
  const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedQuotes = filteredQuotes.slice(startIndex, endIndex)

  const statusCounts = {
    all: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    declined: quotes.filter(q => q.status === 'declined').length,
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-line-soft text-ink"><Clock className="w-3 h-3" /> Draft</span>
      case 'sent':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-molten-tint text-molten-ink"><FileText className="w-3 h-3" /> Sent</span>
      case 'accepted':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-sage-tint text-sage"><CheckCircle className="w-3 h-3" /> Accepted</span>
      case 'declined':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-danger-tint text-danger"><XCircle className="w-3 h-3" /> Declined</span>
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-medium bg-line-soft text-ink">{status}</span>
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-molten border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-basalt">Quotes</h1>
          <p className="text-stone text-sm mt-1">{quotes.length} total quotes</p>
        </div>
        <Button onClick={() => navigate('/')} className="gap-2">
          <Plus className="w-4 h-4" />
          New Quote
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
          <input
            type="text"
            placeholder="Search by reference, client, project, or creator..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-track text-base"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {profile?.role === 'admin' && creators.length > 1 && (
          <select
            className="px-3 py-2 rounded-lg border border-line bg-bone text-sm"
            value={creatorFilter}
            onChange={e => setCreatorFilter(e.target.value)}
          >
            <option value="all">All Users</option>
            {creators.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          {(['all', 'draft', 'sent', 'accepted', 'declined'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-charcoal text-white'
                  : 'bg-line-soft text-ink hover:bg-track'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-1 text-xs opacity-70">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-ash mx-auto mb-4" />
          <h3 className="text-lg font-medium text-basalt mb-2">No quotes found</h3>
          <p className="text-stone mb-4">
            {search || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Create your first quote using the calculator'}
          </p>
          <Button onClick={() => navigate('/')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedQuotes.map(quote => (
            <Link
              key={quote.id}
              to={`/quotes/${quote.id}`}
              className="block"
            >
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono font-medium text-molten-ink">{quote.reference}</span>
                      {getStatusBadge(quote.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-ink">
                      {quote.client_name && (
                        <span className="font-medium">{quote.client_name}</span>
                      )}
                      {quote.project_name && (
                        <span className="text-ash">• {quote.project_name}</span>
                      )}
                      {!quote.client_name && !quote.project_name && (
                        <span className="text-ash italic">No client details</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-ash mt-2">
                      <span>{quote.surface_type}</span>
                      <span>•</span>
                      <span>
                        {quote.floor_area > 0 && `${quote.floor_area}m² floor`}
                        {quote.floor_area > 0 && quote.wall_area > 0 && ' + '}
                        {quote.wall_area > 0 && `${quote.wall_area}m² wall`}
                      </span>
                      <span>•</span>
                      <span>{formatDate(quote.created_at)}</span>
                      {profile?.role === 'admin' && quote.creator_name && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {quote.creator_name}
                          </span>
                        </>
                      )}
                      {quote.updated_at !== quote.created_at && (
                        <>
                          <span>•</span>
                          <span className="text-molten-ink">Updated</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-basalt">£{formatCurrency(quote.total)}</div>
                      <div className="text-xs text-ash">inc. VAT</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ash" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-stone">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredQuotes.length)} of {filteredQuotes.length} quotes
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm text-ink">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
