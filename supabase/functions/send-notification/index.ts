import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { type, recipientEmail, recipientName, subject, body, actionUrl, actionLabel } = await req.json()

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
    const FROM_EMAIL = 'noreply@csdtvstaff.org'
    const APP_URL = 'https://www.csdtvstaff.org'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0d1525;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
    <div style="background:#111827;padding:20px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="color:#5ba3e0;font-size:14px;font-weight:600;">CSDtv Team Hub</span>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#f0f4ff;font-size:20px;font-weight:600;margin:0 0 12px;">${subject}</h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px;">Hi ${recipientName}, ${body}</p>
      ${actionUrl ? `<a href="${APP_URL}${actionUrl}" style="display:inline-block;background:#1e6cb5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">${actionLabel || 'View in CSDtv Hub'}</a>` : ''}
      <p style="color:#64748b;font-size:12px;margin:24px 0 0;">
        <a href="${APP_URL}" style="color:#5ba3e0;text-decoration:none;">CSDtv Team Hub</a> · Canyons School District TV Production
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
        to: [recipientEmail],
        subject,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Resend error')

    return new Response(JSON.stringify({ success: true, id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('send-notification error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})