import { Spinner } from '@/components/ui/spinner'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logUpdate } from '@/lib/activityLog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Mail, Shield, ShieldOff, ChevronLeft, ChevronRight, Copy, ChevronDown, ChevronUp, Check, UserPlus, X, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'

const ITEMS_PER_PAGE = 20

// Public URL the app is served from. Invite/reset links and shared login
// details must always point here — never at a dev origin (localhost), which
// would otherwise leak into invite emails when an admin tests locally.
const APP_URL = import.meta.env.VITE_APP_URL || 'https://calculator.magmacoatings.com'

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

interface LoginLog {
  id: string
  ip_address: string | null
  city: string | null
  region: string | null
  country: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  success: boolean | null
  logged_in_at: string
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Editable contact details + per-user login history (admin)
  const [detailForm, setDetailForm] = useState<Partial<Profile>>({})
  const [savingDetails, setSavingDetails] = useState(false)
  const [savedDetails, setSavedDetails] = useState(false)
  const [userLogins, setUserLogins] = useState<LoginLog[]>([])
  const [loginsLoading, setLoginsLoading] = useState(false)
  const [userQuotes, setUserQuotes] = useState<{ id: string; reference: string; project_name: string | null; client_name: string | null; total: number; status: string; created_at: string }[]>([])
  const [resetPwResult, setResetPwResult] = useState<{ userId: string; password: string } | null>(null)
  const [resettingPw, setResettingPw] = useState(false)

  async function openDetails(user: Profile) {
    if (expandedId === user.id) { setExpandedId(null); return }
    setExpandedId(user.id)
    setSavedDetails(false)
    setResetPwResult(null)
    setDetailForm({
      first_name: user.first_name || '', last_name: user.last_name || '',
      company_name: user.company_name || '',
      address_line1: user.address_line1 || '', address_line2: user.address_line2 || '', address_line3: user.address_line3 || '',
      town_city: user.town_city || '', postcode: user.postcode || '',
      phone: user.phone || '', mobile: user.mobile || '',
      website_url: user.website_url || '', instagram_handle: user.instagram_handle || '', facebook_url: user.facebook_url || '',
    })
    setUserLogins([])
    setLoginsLoading(true)
    const { data } = await supabase
      .from('login_logs')
      .select('id, ip_address, city, region, country, device_type, browser, os, success, logged_in_at')
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .limit(25)
    setUserLogins((data as LoginLog[]) || [])
    setLoginsLoading(false)

    // The installer's saved quotes (admins can read all quotes)
    setUserQuotes([])
    const { data: q } = await supabase
      .from('quotes')
      .select('id, reference, project_name, client_name, total, status, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setUserQuotes((q as typeof userQuotes) || [])
  }

  async function resetUserPassword(userId: string) {
    if (!window.confirm('Set a new password for this user?\n\nYou will be given a new password to send them. Their current password will stop working.')) return
    setResettingPw(true)
    setResetPwResult(null)
    const { data, error } = await supabase.functions.invoke('set-password', { body: { user_id: userId } })
    setResettingPw(false)
    if (error || (data && data.error)) {
      alert('Could not reset password: ' + ((data && data.error) || error?.message || 'unknown error'))
      return
    }
    setResetPwResult({ userId, password: data.password })
    logUpdate('user', userId, 'password reset', { reset: true })
  }

  async function saveUserDetails(userId: string) {
    setSavingDetails(true)
    const fullName = [detailForm.first_name, detailForm.last_name].filter(Boolean).join(' ').trim()
    const patch: Partial<Profile> = {
      first_name: detailForm.first_name?.trim() || null,
      last_name: detailForm.last_name?.trim() || null,
      company_name: detailForm.company_name?.trim() || null,
      address_line1: detailForm.address_line1?.trim() || null,
      address_line2: detailForm.address_line2?.trim() || null,
      address_line3: detailForm.address_line3?.trim() || null,
      town_city: detailForm.town_city?.trim() || null,
      postcode: detailForm.postcode?.trim() || null,
      phone: detailForm.phone?.trim() || null,
      mobile: detailForm.mobile?.trim() || null,
      website_url: detailForm.website_url?.trim() || null,
      instagram_handle: detailForm.instagram_handle?.trim() || null,
      facebook_url: detailForm.facebook_url?.trim() || null,
    }
    if (fullName) patch.full_name = fullName
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    setSavingDetails(false)
    if (error) { alert('Error saving details: ' + error.message); return }
    logUpdate('user', userId, detailForm.company_name || 'Unknown', { edited: 'contact details' })
    setSavedDetails(true)
    setTimeout(() => setSavedDetails(false), 2500)
    fetchUsers()
  }

  // Invite-new-user form
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string; credentials?: { email: string; password: string } } | null>(null)
  const [newUser, setNewUser] = useState({ email: '', first_name: '', last_name: '', company_name: '', role: 'installer', mode: 'invite', password: '' })

  async function inviteUser() {
    if (!newUser.email.trim()) { setInviteResult({ ok: false, msg: 'Email is required' }); return }
    setInviting(true)
    setInviteResult(null)
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { ...newUser, redirect_to: `${APP_URL}/reset-password` },
    })
    setInviting(false)
    if (error || (data && data.error)) {
      setInviteResult({ ok: false, msg: (data && data.error) || error?.message || 'Failed to create user' })
      return
    }
    if (newUser.mode === 'password' && data?.password) {
      setInviteResult({
        ok: true,
        msg: `Account created for ${newUser.email}. Send them these details:`,
        credentials: { email: newUser.email, password: data.password },
      })
    } else {
      setInviteResult({ ok: true, msg: `Invite sent to ${newUser.email}. They'll set their own password from the email.` })
    }
    setNewUser({ email: '', first_name: '', last_name: '', company_name: '', role: 'installer', mode: newUser.mode, password: '' })
    fetchUsers()
  }

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
      // Derive each user's last login from login_logs (profiles.last_login isn't written).
      // One query, ordered newest-first, so the first row seen per user_id is their latest.
      const { data: logs } = await supabase
        .from('login_logs')
        .select('user_id, logged_in_at')
        .order('logged_in_at', { ascending: false })
      const lastByUser: { [id: string]: string } = {}
      for (const l of logs || []) {
        if (l.user_id && !lastByUser[l.user_id]) lastByUser[l.user_id] = l.logged_in_at
      }
      setUsers((data || []).map(u => ({ ...u, last_login: lastByUser[u.id] ?? u.last_login ?? null })))
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

  async function deleteUser(userId: string, email: string) {
    if (userId === currentUser?.id) {
      alert("You can't delete your own account.")
      return
    }
    if (!window.confirm(`Permanently delete ${email}?\n\nThis removes their login and account completely. This cannot be undone. (Useful for re-testing with the same email.)`)) {
      return
    }
    const { data, error } = await supabase.functions.invoke('delete-user', { body: { user_id: userId } })
    if (error || (data && data.error)) {
      alert('Could not delete user: ' + ((data && data.error) || error?.message || 'unknown error'))
      return
    }
    logUpdate('user', userId, email, { deleted: true })
    fetchUsers()
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

  async function copyToClipboard(text: string, fieldId: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-HTTPS / older browsers where navigator.clipboard is unavailable
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        ta.setAttribute('readonly', '')
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (e) {
      console.error('Copy failed', e)
      alert('Could not copy automatically — please select the text and copy it manually.')
    }
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
      <Spinner />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-basalt">Users</h1>
          <p className="text-stone text-sm mt-1">{users.length} total users</p>
        </div>
        <Button onClick={() => { setShowInvite(v => !v); setInviteResult(null) }} className="gap-2 shrink-0">
          {showInvite ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showInvite ? 'Cancel' : 'Invite User'}
        </Button>
      </div>

      {/* Invite new user */}
      {showInvite && (
        <Card className="p-5 mb-6 border-2 border-dashed border-molten/40">
          <h3 className="font-medium text-basalt mb-1">Add a new user</h3>
          <p className="text-stone text-sm mb-4">No one can sign up without being added here.</p>

          {/* Mode selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setNewUser({ ...newUser, mode: 'invite' })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${newUser.mode === 'invite' ? 'bg-basalt text-bone border-basalt' : 'bg-bone border-line text-ink hover:border-stone'}`}
            >
              Email invite (they set their password)
            </button>
            <button
              type="button"
              onClick={() => setNewUser({ ...newUser, mode: 'password' })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${newUser.mode === 'password' ? 'bg-basalt text-bone border-basalt' : 'bg-bone border-line text-ink hover:border-stone'}`}
            >
              Set a password &amp; send it personally
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm text-ink mb-1">Email address *</label>
              <Input type="email" placeholder="name@company.com" value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">First name</label>
              <Input value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">Last name</label>
              <Input value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">Company</label>
              <Input value={newUser.company_name} onChange={e => setNewUser({ ...newUser, company_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-ink mb-1">Role</label>
              <select className="w-full px-3 py-2 rounded-lg border border-line bg-bone min-h-[44px]"
                value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                <option value="installer">Installer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {newUser.mode === 'password' && (
            <div className="mt-3">
              <label className="block text-sm text-ink mb-1">Password (leave blank to auto-generate)</label>
              <Input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Auto-generated if blank" />
            </div>
          )}

          {inviteResult && (
            <div className={`text-sm mt-4 p-3 rounded-lg ${inviteResult.ok ? 'bg-sage-tint text-sage' : 'bg-danger-tint text-danger'}`}>
              <p>{inviteResult.msg}</p>
              {inviteResult.credentials && (
                <div className="mt-2 bg-bone border border-line rounded-lg p-3 text-ink">
                  <p className="font-mono text-xs break-all">Login: {APP_URL}</p>
                  <p className="font-mono text-xs break-all">Email: {inviteResult.credentials.email}</p>
                  <p className="font-mono text-xs break-all">Password: {inviteResult.credentials.password}</p>
                  <Button
                    variant="outline" size="sm" className="mt-2 gap-1"
                    onClick={() => copyToClipboard(
                      `Magma Calculator login:\n${APP_URL}\nEmail: ${inviteResult.credentials!.email}\nPassword: ${inviteResult.credentials!.password}\n\nPlease change your password after logging in.`,
                      'creds'
                    )}
                  >
                    {copiedField === 'creds' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'creds' ? 'Copied' : 'Copy details to send'}
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <Button onClick={inviteUser} disabled={inviting}>
              {inviting ? 'Saving…' : (newUser.mode === 'password' ? 'Create user' : 'Send invite')}
            </Button>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Close</Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-track text-base"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-line bg-bone text-sm"
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
          <Users className="w-12 h-12 text-ash mx-auto mb-4" />
          <h3 className="text-lg font-medium text-basalt mb-2">No users found</h3>
          <p className="text-stone">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedUsers.map(user => (
            <Card key={user.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium text-basalt">{user.full_name || 'Unnamed User'}</span>
                    {user.company_name && (
                      <span className="text-sm text-stone">({user.company_name})</span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-track text-stone' : 'bg-line-soft text-ink'
                    }`}>
                      {user.role}
                    </span>
                    {user.status === 'suspended' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger-tint text-danger">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone">{user.email}</p>
                  <div className="flex gap-4 text-xs text-ash mt-2">
                    <span>Joined: {formatDate(user.created_at)}</span>
                    <span>Last login: {formatDate(user.last_login)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDetails(user)}
                    className="gap-1"
                  >
                    {expandedId === user.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Details
                  </Button>
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
                  {user.id !== currentUser?.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteUser(user.id, user.email)}
                      title="Permanently delete this user"
                      className="text-danger hover:bg-danger-tint hover:border-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded Details: editable contact + login history */}
              {expandedId === user.id && (
                <div className="mt-4 pt-4 border-t border-line-soft space-y-6">
                  {/* Editable contact details */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-stone uppercase tracking-wide">Contact details</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => copyToClipboard(getFormattedAddress(user), `addr-${user.id}`)}>
                          {copiedField === `addr-${user.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === `addr-${user.id}` ? 'Copied' : 'Copy address'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => copyToClipboard(getAllContactDetails(user), `all-${user.id}`)}>
                          {copiedField === `all-${user.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === `all-${user.id}` ? 'Copied' : 'Copy all'}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        ['first_name', 'First name'], ['last_name', 'Last name'],
                        ['company_name', 'Company'], ['address_line1', 'Address line 1'],
                        ['address_line2', 'Address line 2'], ['address_line3', 'Address line 3'],
                        ['town_city', 'Town / City'], ['postcode', 'Postcode'],
                        ['phone', 'Phone'], ['mobile', 'Mobile'],
                        ['website_url', 'Website'], ['instagram_handle', 'Instagram'],
                        ['facebook_url', 'Facebook'],
                      ] as [keyof Profile, string][]).map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-xs text-stone mb-1">{label}</label>
                          <Input
                            value={(detailForm[key] as string) || ''}
                            onChange={e => setDetailForm(f => ({ ...f, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-ash mt-2">Email ({user.email}) is the login and can't be changed here.</p>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => saveUserDetails(user.id)} disabled={savingDetails}>
                        {savingDetails ? 'Saving…' : savedDetails ? 'Saved ✓' : 'Save changes'}
                      </Button>
                    </div>
                  </div>

                  {/* Login history */}
                  <div>
                    <span className="text-xs font-medium text-stone uppercase tracking-wide">Recent logins</span>
                    {loginsLoading ? (
                      <p className="text-sm text-ash mt-2">Loading…</p>
                    ) : userLogins.length === 0 ? (
                      <p className="text-sm text-ash mt-2">No logins recorded yet.</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-stone uppercase text-left border-b border-line">
                              <th className="py-2 pr-4 font-medium whitespace-nowrap">When</th>
                              <th className="py-2 pr-4 font-medium">Device</th>
                              <th className="py-2 pr-4 font-medium">Location</th>
                              <th className="py-2 font-medium">IP address</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userLogins.map(l => (
                              <tr key={l.id} className="border-b border-line-soft">
                                <td className="py-2 pr-4 text-ink whitespace-nowrap">{formatDate(l.logged_in_at)}</td>
                                <td className="py-2 pr-4 text-ink">{[l.browser, l.os].filter(Boolean).join(' / ') || l.device_type || '—'}</td>
                                <td className="py-2 pr-4 text-ink">{[l.city, l.country].filter(Boolean).join(', ') || '—'}</td>
                                <td className="py-2 text-stone tabular-nums">{l.ip_address || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Reset password */}
                  <div>
                    <span className="text-xs font-medium text-stone uppercase tracking-wide">Password</span>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" onClick={() => resetUserPassword(user.id)} disabled={resettingPw}>
                        {resettingPw ? 'Setting…' : 'Set a new password'}
                      </Button>
                    </div>
                    {resetPwResult && resetPwResult.userId === user.id && (
                      <div className="mt-3 bg-bone border border-line rounded-lg p-3">
                        <p className="text-sm text-ink mb-2">New password set — send them these details:</p>
                        <p className="font-mono text-xs break-all">Login: https://calculator.magmacoatings.com</p>
                        <p className="font-mono text-xs break-all">Email: {user.email}</p>
                        <p className="font-mono text-xs break-all">Password: {resetPwResult.password}</p>
                        <Button variant="outline" size="sm" className="mt-2 gap-1"
                          onClick={() => copyToClipboard(`Magma Calculator login:\nhttps://calculator.magmacoatings.com\nEmail: ${user.email}\nPassword: ${resetPwResult.password}\n\nPlease change your password after logging in.`, `pw-${user.id}`)}>
                          {copiedField === `pw-${user.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedField === `pw-${user.id}` ? 'Copied' : 'Copy details to send'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Saved quotes */}
                  <div>
                    <span className="text-xs font-medium text-stone uppercase tracking-wide">Saved quotes ({userQuotes.length})</span>
                    {userQuotes.length === 0 ? (
                      <p className="text-sm text-ash mt-2">No quotes yet.</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-stone uppercase text-left border-b border-line">
                              <th className="py-2 pr-4 font-medium whitespace-nowrap">Ref</th>
                              <th className="py-2 pr-4 font-medium">Project / client</th>
                              <th className="py-2 pr-4 font-medium">Status</th>
                              <th className="py-2 pr-4 font-medium whitespace-nowrap">Date</th>
                              <th className="py-2 font-medium text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userQuotes.map(qt => (
                              <tr key={qt.id} className="border-b border-line-soft hover:bg-limestone cursor-pointer" onClick={() => navigate(`/quotes/${qt.id}`)}>
                                <td className="py-2 pr-4 text-molten-ink font-medium whitespace-nowrap">{qt.reference}</td>
                                <td className="py-2 pr-4 text-ink">{qt.project_name || qt.client_name || '—'}</td>
                                <td className="py-2 pr-4 text-ink capitalize">{qt.status}</td>
                                <td className="py-2 pr-4 text-stone whitespace-nowrap">{formatDate(qt.created_at)}</td>
                                <td className="py-2 text-ink text-right tabular-nums">£{(qt.total ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-stone">
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
