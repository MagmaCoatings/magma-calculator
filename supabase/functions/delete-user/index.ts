// Supabase Edge Function: delete-user
// Lets an ADMIN permanently delete a user (handy for re-testing with the same email).
// Verifies the caller is an admin, refuses self-deletion, then uses the service role
// to delete the auth user (their profile row cascades / is removed too).

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
    const userId = (body.user_id || '').trim()
    if (!userId) return json({ error: 'user_id is required' }, 400)
    if (userId === caller.id) {
      return json({ error: "You can't delete your own account." }, 400)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

    // 3) Delete the profile row first (in case there's no FK cascade), then the auth user
    await admin.from('profiles').delete().eq('id', userId)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      return json({ error: error.message }, 400)
    }

    return json({ success: true, user_id: userId }, 200)
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
