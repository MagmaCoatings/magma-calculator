import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logUpdate } from '@/lib/activityLog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Mail, Shield, ShieldOff, ChevronLeft, ChevronRight, Copy, ChevronDown, ChevronUp, Check } from 'lucide-react'

const ITEMS_PER_PAGE = 20

interface Profile {
  id: string
  email: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  address_line1: string | null
  address_line2: string | null
  address_line3: string | null
  town_city: string | null
  postcode: string | null
  phone: string | null
  mobile: string | null
  instagram_handle: string | null
  facebook_url: string | null
  website_url: string | null
  role: string
  status: string
  created_at: string
  last_login: string | null
}

export function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, roleFilter])

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  async function toggleRole(userId: string, currentRole: string) {
    const user = users.find(u => u.id === userId)
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    } else {
      // Log activity
      logUpdate('user', userId, user?.email || 'Unknown', { role: newRole })
      
      fetchUsers()
    }
  }

  async function toggleStatus(userId: string, currentStatus: string) {
    const user = users.find(u => u.id === userId)
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', userId)

    if (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    } else {
      // Log activity
      logUpdate('user', userId, user?.email || 'Unknown', { status: newStatus })
      
      fetchUsers()
    }
  }

  function getFormattedAddress(user: Profile): string {
    const lines = [
      [user.first_name, user.last_name].filter(Boolean).join(' '),
      user.company_name,
      user.address_line1,
      user.address_line2,
      user.address_line3,
      [user.town_city, user.postcode].filter(Boolean).join(', '),
    ].filter(Boolean)
    return lines.join('\n')
  }

  function getAllContactDetails(user: Profile): string {
    const lines = [
      [user.first_name, user.last_name].filter(Boolean).join(' '),
      user.company_name,
      user.address_line1,
      user.address_line2,
      user.address_line3,
      [user.town_city, user.postcode].filter(Boolean).join(', '),
      '',
      user.email,
      user.phone ? `Phone: ${user.phone}` : null,
      user.mobile ? `Mobile: ${user.mobile}` : null,
      user.website_url ? `Web: ${user.website_url}` : null,
      user.instagram_handle ? `Instagram: @${user.instagram_handle}` : null,
      user.facebook_url ? `Facebook: ${user.facebook_url}` : null,
    ].filter(line => line !== null)
    return lines.join('\n')
  }

  function hasAddress(user: Profile): boolean {
    return !!(user.address_line1 || user.town_city || user.postcode)
  }

  async function copyToClipboard(text: string, fieldId: string) {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.company_name?.toLowerCase() || '').includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="user">Users</option>
        </select>
      </div>

      {/* Users List */}
      {filteredUsers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedUsers.map(user => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-gray-900">{user.full_name || 'Unnamed User'}</span>
                    {user.company_name && (
                      <span className="text-sm text-gray-500">({user.company_name})</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {user.role}
                    </span>
                    {user.status === 'suspended' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{user.email}</p>
                  <div className="flex gap-4 text-xs text-gray-400 mt-2">
                    <span>Joined: {formatDate(user.created_at)}</span>
                    <span>Last login: {formatDate(user.last_login)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasAddress(user) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === user.id ? null : user.id)}
                      className="gap-1"
                    >
                      {expandedId === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      Details
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRole(user.id, user.role)}
                    title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                  >
                    {user.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant={user.status === 'active' ? 'outline' : 'destructive'}
                    size="sm"
                    onClick={() => toggleStatus(user.id, user.status)}
                  >
                    {user.status === 'active' ? 'Suspend' : 'Activate'}
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === user.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Address */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase">Address (for labels)</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => copyToClipboard(getFormattedAddress(user), `addr-${user.id}`)}
                        >
                          {copiedField === `addr-${user.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === `addr-${user.id}` ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{getFormattedAddress(user)}</pre>
                    </div>

                    {/* All Contact Details */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase">All Contact Details</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => copyToClipboard(getAllContactDetails(user), `all-${user.id}`)}
                        >
                          {copiedField === `all-${user.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === `all-${user.id}` ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{getAllContactDetails(user)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
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
                <span className="px-3 py-1 text-sm text-gray-600">
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
