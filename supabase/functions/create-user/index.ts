// Supabase Edge Function: create-user
// Lets an ADMIN invite a new user (invite-only — no public sign-up).
// Verifies the caller is an admin, then uses the service role to create the
// auth user, send an invite email (user sets their own password), and create
// their profile row with the chosen role/company.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    // 1) Verify the caller is a signed-in admin
    const authHeader = req.headers.get('Authorization') || ''
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) {
      return json({ error: 'Not authenticated' }, 401)
    }
    const { data: callerProfile } = await callerClient
      .from('profiles').select('role').eq('id', caller.id).single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Admin access required' }, 403)
    }

    // 2) Parse + validate input
    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').trim().toLowerCase()
    const role = body.role === 'admin' ? 'admin' : 'installer'
    const firstName = (body.first_name || '').trim()
    const lastName = (body.last_name || '').trim()
    const companyName = (body.company_name || '').trim()
    const redirectTo = body.redirect_to || `${SUPABASE_URL}`
    // mode: 'invite' (email link, user sets own password) | 'password' (admin gets a password to share)
    const mode = body.mode === 'password' ? 'password' : 'invite'
    if (!email || !email.includes('@')) {
      return json({ error: 'A valid email is required' }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
    const fullName = [firstName, lastName].filter(Boolean).join(' ')
    let userId: string
    let tempPassword: string | undefined

    // 3) Create the user — either via invite email, or directly with a password
    if (mode === 'password') {
      const password = (body.password || '').trim() || generatePassword()
      tempPassword = password
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip confirmation so they can log in immediately
        user_metadata: { full_name: fullName, company_name: companyName },
      })
      if (error || !data?.user) return json({ error: error?.message || 'Could not create user' }, 400)
      userId = data.user.id
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName, company_name: companyName },
      })
      if (error || !data?.user) return json({ error: error?.message || 'Could not create user' }, 400)
      userId = data.user.id
    }

    // 4) Upsert the profile row with role/company/name
    const { error: profileErr } = await admin.from('profiles').upsert({
      id: userId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName || null,
      company_name: companyName || null,
      role,
      status: 'active',
    })
    if (profileErr) {
      return json({ error: 'User created but profile failed: ' + profileErr.message }, 500)
    }

    return json({ success: true, user_id: userId, email, mode, password: tempPassword }, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Generate a reasonably strong temporary password (admin shares it with the user)
function generatePassword(): string {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  const base = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '')
  return 'Mg' + base.slice(0, 9) + '7!'
}
