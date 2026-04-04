import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { email, name, role, invitedBy } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const FROM_EMAIL = 'noreply@csdtvstaff.org'
    const LOGIN_URL = 'https://www.csdtvstaff.org/login'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0d1525;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="background:#1e6cb5;padding:32px 32px 24px;">
      <h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 6px;">You're invited to CSDtv Team Hub</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0;">${invitedBy} has added you to the team</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#f0f4ff;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${name}, you've been added to the CSDtv Team Hub as <strong>${role}</strong>. This is where the team manages productions, tasks, and schedules.
      </p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
        To get started, click the button below and enter your district email address. You'll receive a magic link to log in — no password needed.
      </p>
      <a href="${LOGIN_URL}" style="display:inline-block;background:#1e6cb5;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">Log in to CSDtv Team Hub →</a>
      <p style="color:#8899bb;font-size:12px;margin:24px 0 0;line-height:1.5;">
        Log in at: <a href="${LOGIN_URL}" style="color:#5ba3e0;">${LOGIN_URL}</a><br>
        Use your district email: <strong style="color:#f0f4ff;">${email}</strong>
      </p>
    </div>
  </div>
</body>
</html>`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `CSDtv Team Hub <${FROM_EMAIL}>`,
        to: [email],
        subject: `${invitedBy} invited you to CSDtv Team Hub`,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Failed to send email')

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})