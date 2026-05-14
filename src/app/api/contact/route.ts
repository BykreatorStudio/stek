import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { name, email, type, message } = await request.json()
  if (!name || !email || !type || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Štediša <stedisa@bykreator.com>',
      to: ['contact@bykreator.com'],
      reply_to: [email],
      subject: `[Štediša] ${type} — ${name}`,
      html: contactHtml(name, email, type, message),
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Greška pri slanju' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

function contactHtml(name: string, email: string, type: string, message: string) {
  const safeMsg = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:32px 32px 24px;background:#1D200F;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#C8FF31;letter-spacing:-0.3px;">Štediša</p>
            <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.45);">${type}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 16px;">
            <p style="margin:0 0 4px;font-size:11px;color:#a0a0a0;font-weight:500;letter-spacing:0.04em;">OD</p>
            <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#0a0a0a;">${name}</p>
            <p style="margin:0 0 24px;font-size:13px;color:#888;">${email}</p>
            <p style="margin:0 0 4px;font-size:11px;color:#a0a0a0;font-weight:500;letter-spacing:0.04em;">PORUKA</p>
            <p style="margin:0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${safeMsg}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 20px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#c0c0c0;text-align:center;">Štediša · Bykreator Studio</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
