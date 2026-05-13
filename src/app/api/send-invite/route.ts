import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, code } = await request.json()
  if (!email || !code) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: member } = await supabase
    .from('members')
    .select('name')
    .eq('user_id', user.id)
    .single()

  const senderName = member?.name ?? 'Neko'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Štediša <stedisa@bykreator.com>',
      to: [email],
      subject: `${senderName} te poziva na Štediša`,
      html: inviteHtml(senderName, code),
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Email nije poslat' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function inviteHtml(senderName: string, code: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:40px 32px 32px;background:#1D200F;">
            <img src="https://stedisa.bykreator.com/icons/icon-192.png" width="72" height="72" alt="Štediša" style="display:block;border-radius:18px;margin:0 auto;">
            <p style="margin:16px 0 0;font-size:22px;font-weight:600;color:#C8FF31;letter-spacing:-0.5px;">Štediša</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 16px;">
            <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#0a0a0a;letter-spacing:-0.3px;">${senderName} te poziva!</p>
            <p style="margin:0 0 28px;font-size:15px;color:#666;line-height:1.6;">Pridruži se Štediši! Koristi pozivni kod ispod pri registraciji.</p>
            <div style="background:#f4f4f2;border-radius:16px;padding:24px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#a0a0a0;font-weight:500;letter-spacing:0.05em;">Pozivni kod</p>
              <p style="margin:0;font-size:36px;font-weight:400;color:#0a0a0a;letter-spacing:8px;">${code}</p>
            </div>
            <a href="https://stedisa.bykreator.com/register" style="display:block;text-align:center;background:#1D200F;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:16px 24px;border-radius:14px;letter-spacing:-0.2px;">Otvori Štedišu</a>
            <p style="margin:20px 0 0;font-size:13px;color:#a0a0a0;text-align:center;line-height:1.6;">Kod važi 10 minuta. Odaberi "Pridruži se" pri registraciji i unesi ovaj kod.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#c0c0c0;text-align:center;">© 2026 Štediša | Bykreator Studio</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
