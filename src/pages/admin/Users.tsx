import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/formatters'
import type { Profile } from '@/lib/types'
import { Plus, Search, Shield, User, Ban, CheckCircle } from 'lucide-react'

export function UsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    role: 'installer' as 'admin' | 'installer',
  })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

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

  async function addUser() {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      alert('Please fill in email, password, and full name')
      return
    }

    setAdding(true)

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: newUser.email,
      password: newUser.password,
      email_confirm: true,
    })

    if (authError) {
      // Try signup instead (admin API might not be available)
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      })

      if (signupError) {
        alert('Error creating user: ' + signupError.message)
        setAdding(false)
        return
      }

      // Update profile
      if (signupData.user) {
        await supabase
          .from('profiles')
          .update({
            full_name: newUser.full_name,
            company_name: newUser.company_name,
            role: newUser.role,
            status: 'active',
          })
          .eq('id', signupData.user.id)
      }
    } else if (authData.user) {
      // Update profile
      await supabase
        .from('profiles')
        .update({
          full_name: newUser.full_name,
          company_name: newUser.company_name,
          role: newUser.role,
          status: 'active',
        })
        .eq('id', authData.user.id)
    }

    await fetchUsers()
    setShowAddForm(false)
    setNewUser({
      email: '',
      password: '',
      full_name: '',
      company_name: '',
      role: 'installer',
    })
    setAdding(false)
  }

  async function updateStatus(id: string, status: 'active' | 'suspended') {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', id)

    if (error) {
      alert('Error updating user: ' + error.message)
    } else {
      setUsers(users.map(u => u.id === id ? { ...u, status } : u))
    }
  }

  async function updateRole(id: string, role: 'admin' | 'installer') {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)

    if (error) {
      alert('Error updating user: ' + error.message)
    } else {
      setUsers(users.map(u => u.id === id ? { ...u, role } : u))
    }
  }

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => setShowAddForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New User</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="installer@company.com"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
              />
              <Input
                label="Full Name"
                placeholder="John Smith"
                value={newUser.full_name}
                onChange={e => setNewUser({ ...newUser, full_name: e.target.value })}
              />
              <Input
                label="Company Name"
                placeholder="ABC Flooring Ltd"
                value={newUser.company_name}
                onChange={e => setNewUser({ ...newUser, company_name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-gray-200"
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'installer' })}
                >
                  <option value="installer">Installer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addUser} disabled={adding}>
                {adding ? 'Creating...' : 'Create User'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              Note: The user will need to confirm their email before they can log in.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => (
                <tr key={user.id} className={user.status === 'suspended' ? 'bg-red-50 opacity-70' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        user.role === 'admin' ? 'bg-magma text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name || 'Unnamed'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.company_name || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <select
                      className="px-2 py-1 rounded border border-gray-200 text-sm"
                      value={user.role}
                      onChange={e => updateRole(user.id, e.target.value as 'admin' | 'installer')}
                    >
                      <option value="installer">Installer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : user.status === 'suspended'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.status === 'active' ? (
                      <button
                        onClick={() => updateStatus(user.id, 'suspended')}
                        className="flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
                      >
                        <Ban className="w-3 h-3" />
                        Suspend
                      </button>
                    ) : (
                      <button
                        onClick={() => updateStatus(user.id, 'active')}
                        className="flex items-center gap-1 px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
