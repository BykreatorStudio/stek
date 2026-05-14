import Link from 'next/link'
import { Logomark, Wordmark } from '@/components/ui/AuthLogo'
import ContactSection from './ContactSection'

const VERSION = '0.1.0'

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--card)', borderRadius: 16, padding: '20px 18px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 14, ...style }}>
      {children}
    </p>
  )
}

function FeatureRow({ icon, title, desc, last }: {
  icon: React.ReactNode; title: string; desc: string; last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      paddingBottom: last ? 0 : 16, marginBottom: last ? 0 : 16,
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      {icon}
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>{desc}</p>
      </div>
    </div>
  )
}

function IconBox({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 11, background: bg, flexShrink: 0, marginTop: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {children}
    </div>
  )
}

function DataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
      paddingBottom: last ? 0 : 12, marginBottom: last ? 0 : 12,
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.5 }}>{value}</p>
    </div>
  )
}

export default function OAplikacijiPage() {
  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>O aplikaciji</p>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Hero */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#111111', padding: '36px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
            <Logomark size={64} />
            <Wordmark width={130} color="#ffffff" />
          </div>
          <div style={{ padding: '20px 20px 22px' }}>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, textAlign: 'center' }}>
              Aplikacija za praćenje finansija — privatno ili zajedno, svejedno. Znaš tačno gde ide svaki dinar.
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 14 }}>Verzija {VERSION}</p>
          </div>
        </Card>

        {/* Features */}
        <Card>
          <Label>Šta sve možeš</Label>

          <FeatureRow
            icon={
              <IconBox bg="rgba(90,151,0,0.1)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5a9700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M7 15l5 5 5-5M7 9l5-5 5 5" />
                </svg>
              </IconBox>
            }
            title="Prihodi i rashodi"
            desc="Unosi transakcije po kategorijama i grupama, vidiš ko je šta potrošio i zarađivao svaki mesec."
          />

          <FeatureRow
            icon={
              <IconBox bg="rgba(180,83,9,0.1)">
                <svg width="17" height="15" viewBox="0 0 39.56 39.77" fill="none" stroke="#b45309" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.02,38.27h27.36c2.03,0,3.68-1.65,3.68-3.68V10.69L28.86,1.5H10.69c-2.03,0-3.68,1.65-3.68,3.68v7.35" />
                  <path d="M27.03,1.5v7.35c0,2.03,1.65,3.68,3.68,3.68h7.35" />
                  <path d="M1.5,25.4h11.03" />
                  <path d="M7.02,19.89v11.03" />
                </svg>
              </IconBox>
            }
            title="Mesečne obaveze"
            desc="Fiksni i varijabilni računi, krediti, čekovi i pozajmice — sa statusom plaćanja za svaki mesec."
          />

          <FeatureRow
            icon={
              <IconBox bg="rgba(217,48,37,0.1)">
                <svg width="17" height="12" viewBox="0 0 38.76 28.03" fill="none" stroke="#d93025" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M37.26,8.65v14.3c0,1.97-1.6,3.58-3.58,3.58H5.08c-1.98,0-3.58-1.6-3.58-3.58V5.08c0-1.97,1.6-3.58,3.58-3.58h28.61c1.98,0,3.58,1.6,3.58,3.58,0,0,0,3.58,0,3.58ZM37.26,8.65H1.5" />
                </svg>
              </IconBox>
            }
            title="Krediti"
            desc="Praćenje svih kredita — iznos rate, preostali dug, rok i ukupno stanje."
          />

          <FeatureRow
            icon={
              <IconBox bg="rgba(90,151,0,0.1)">
                <svg width="17" height="16" viewBox="0 0 40 38" fill="#5a9700">
                  <path d="M7.5,38c-.7,0-1.36-.23-1.97-.7-.62-.47-1.02-1.03-1.23-1.7-.83-2.87-1.53-5.34-2.08-7.42-.55-2.08-.99-3.91-1.32-5.48-.33-1.57-.56-2.97-.7-4.19-.14-1.22-.21-2.39-.21-3.5,0-3.07,1.07-5.67,3.2-7.8,2.13-2.13,4.73-3.2,7.8-3.2h10c.9-1.2,2.04-2.17,3.42-2.9,1.38-.73,2.91-1.1,4.58-1.1.83,0,1.54.29,2.12.88s.88,1.29.88,2.12c0,.2-.03.4-.08.6s-.11.38-.17.55c-.13.37-.26.73-.38,1.1-.12.37-.21.77-.28,1.2l4.55,4.55h2.85c.42,0,.78.14,1.07.43.29.29.43.64.43,1.07v11.35c0,.34-.09.64-.28.91-.18.26-.44.44-.78.54l-4.6,1.51-2.7,9.03c-.2.65-.56,1.18-1.09,1.57-.53.39-1.13.58-1.81.58h-5.75c-.83,0-1.53-.29-2.12-.88-.59-.59-.88-1.29-.88-2.12v-1h-4v1c0,.83-.29,1.53-.88,2.12-.59.59-1.29.88-2.12.88h-5.5ZM7.25,35h5.75v-4h10v4h5.75l3.15-10.5,5.1-1.75v-8.75h-2.6l-6.4-6.4c.03-.57.12-1.26.28-2.07.15-.82.36-1.72.62-2.72-1.43.37-2.7.92-3.8,1.65-1.1.73-1.9,1.58-2.4,2.55h-11.7c-2.21,0-4.1.78-5.66,2.34-1.56,1.56-2.34,3.45-2.34,5.66,0,1.4.37,3.84,1.1,7.33.73,3.48,1.78,7.71,3.15,12.67ZM28,18c.57,0,1.04-.19,1.42-.58s.58-.86.58-1.42-.19-1.04-.58-1.42-.86-.58-1.42-.58-1.04.19-1.42.58-.58.86-.58,1.42.19,1.04.58,1.42.86.58,1.42.58ZM20.5,13c.42,0,.78-.14,1.07-.43.29-.29.43-.65.43-1.07s-.14-.78-.43-1.07c-.29-.28-.64-.43-1.07-.43h-7c-.42,0-.78.14-1.07.43-.29.29-.43.65-.43,1.07s.14.78.43,1.07c.29.28.64.42,1.07.42h7Z" />
                </svg>
              </IconBox>
            }
            title="Štednja"
            desc="Više sefova za različite namene — gotovina, banka, devize. Svaki saldira posebno."
          />

          <FeatureRow
            icon={
              <IconBox bg="rgba(217,48,37,0.1)">
                <svg width="17" height="17" viewBox="0 0 39 39" fill="none" stroke="#d93025" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5,11.5C5.28,5.14,12.15,1.5,19.54,1.5c9.36,0,17.05,7.1,17.96,16.2" />
                  <path d="M10.52,12.3H2.58c-.6,0-1.08-.48-1.08-1.08h0V3.3" />
                  <path d="M36.5,27.5c-2.78,6.36-9.64,10-17.04,10-9.36,0-17.05-7.1-17.96-16.2" />
                  <path d="M28.48,26.7h7.94c.6,0,1.08.48,1.08,1.08,0,0,0,0,0v7.92" />
                </svg>
              </IconBox>
            }
            title="Pozajmice"
            desc="Ko kome duguje — i vi drugima i drugi vama. Sa statusom izmirenja i istorijom."
          />

          <FeatureRow
            icon={
              <IconBox bg="rgba(15,118,110,0.1)">
                <svg width="17" height="17" viewBox="0 0 39.66 38.67" fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.56,23.31l-6.05.86.86-6.05L27.93,2.57c.34-.34.74-.61,1.19-.79.44-.18.92-.28,1.4-.28s.96.09,1.4.28c.44.18.85.45,1.19.79.34.34.61.74.79,1.19.18.44.28.92.28,1.4s-.09.96-.28,1.4c-.18.44-.45.85-.79,1.19l-15.55,15.55Z" />
                  <path d="M8.83,15.17H3.94c-.65,0-1.27.26-1.73.72-.46.46-.72,1.08-.72,1.73v17.11c0,.65.26,1.27.72,1.73.46.46,1.08.72,1.73.72h31.77c.65,0,1.27-.26,1.73-.72s.72-1.08.72-1.73v-17.11c0-.65-.26-1.27-.72-1.73-.46-.46-1.08-.72-1.73-.72h-2.44" />
                </svg>
              </IconBox>
            }
            title="Čekovi"
            desc="Evidencija čekova sa rokovima naplate i statusom isplate."
          />

          <FeatureRow
            icon={
              <IconBox bg="var(--bg-subtle)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </IconBox>
            }
            title="Analitika"
            desc="Grafici prihoda i rashoda po mesecima, pregled po kategorijama i grupama, trend štednje."
          />

          <FeatureRow
            last
            icon={
              <IconBox bg="rgba(99,102,241,0.1)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </IconBox>
            }
            title="Push notifikacije"
            desc="Obaveštenja za nadolazeće račune i rokove — svako podešava šta želi da prima."
          />
        </Card>

        {/* AI */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Label style={{ marginBottom: 0 }}>AI asistent</Label>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D200F', background: '#C8FF31', padding: '3px 10px', borderRadius: 20 }}>
              Uskoro
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.65, marginBottom: 16 }}>
            Radimo na integrisanju AI asistenta koji će razumeti vaše finansije i pomagati vam da donosite bolje odluke.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { title: 'Automatska kategorizacija', desc: 'Predlaže kategoriju na osnovu naziva — ne moraš ručno svaki put.' },
              { title: 'Analiza obrazaca', desc: 'Prepoznaje gde troškovi rastu i upozorava pre nego što postane problem.' },
              { title: 'Pametni budžet', desc: 'Predlaže mesečni budžet po grupama na osnovu vaše istorije.' },
              { title: 'Finansijski uvid', desc: 'Odgovara na pitanja poput "koliko smo potrošili na hranu prošlog kvartala?"' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8FF31', marginTop: 5, flexShrink: 0, border: '1px solid #a8d400' }} />
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-1)' }}>{title} — </span>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Privatnost */}
        <Card>
          <Label>Privatnost i podaci</Label>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
            Vaši podaci su vaši. Ne prodajemo ih, ne delimo ih i ne koristimo ih u reklamne svrhe. Evo tačno šta čuvamo:
          </p>
          <DataRow label="Email adresa" value="Koristi se samo za prijavu. Nikome se ne prosleđuje." />
          <DataRow label="Lozinka" value="Čuva se kao bcrypt hash — niko ne zna vašu lozinku, ni mi." />
          <DataRow label="Ime i fotografija" value="Prikazuju se unutar aplikacije. Fotografija se čuva u Supabase Storage." />
          <DataRow label="Finansijski podaci" value="Vidljivi samo vama i osobama kojima vi date pristup." />
          <DataRow label="Push tokeni" value="Koriste se isključivo za slanje obaveštenja koja vi birate." />
          <DataRow label="Sesije" value="Supabase Auth beleži aktivne sesije radi sigurnosti." last />
          <div style={{ background: 'var(--bg-subtle)', borderRadius: 12, padding: '13px 15px', marginTop: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Nalog i sve podatke možete obrisati u bilo kom trenutku — Podešavanja → Obriši nalog. Brisanje je trenutno i nepovratno.
            </p>
          </div>
        </Card>

        {/* Tehnologija */}
        <Card>
          <Label>Tehnologija</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {['Next.js 15', 'Supabase', 'PostgreSQL', 'Vercel', 'Recharts', 'Web Push API'].map(name => (
              <span key={name} style={{
                fontSize: 12, fontWeight: 500, color: 'var(--text-1)',
                background: 'var(--bg-subtle)', padding: '5px 12px', borderRadius: 20,
                border: '1px solid var(--border)',
              }}>
                {name}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Supabase</span> — baza podataka, autentifikacija, realtime sync i storage za fotografije. Infrastruktura je na EU serverima.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Realtime sync</span> — kad jedan član unese transakciju, drugi odmah vidi promenu bez osvežavanja stranice.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>Vercel</span> — hosting sa automatskim deployment-om pri svakom ažuriranju.
            </p>
          </div>
        </Card>

        {/* Uslovi */}
        <Card>
          <Label>Uslovi korišćenja</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Aplikacija je namenjena za praćenje ličnih i zajedničkih finansija.',
              'Korisnik je odgovoran za tačnost unetih podataka.',
              'Štediša ne pruža finansijske savete niti preporuke za ulaganje.',
              'Zabranjeno je korišćenje aplikacije za nezakonite aktivnosti.',
              'Zadržavamo pravo izmene uslova uz obaveštenje korisnika.',
              'Ukoliko se ne slažete sa uslovima, možete obrisati nalog u Podešavanjima.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border-2)', marginTop: 6, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>{text}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Kontakt */}
        <ContactSection />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>Bykreator Studio</p>
          <a
            href="https://bykreator.com/rs"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' }}
          >
            bykreator.com/rs ↗
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', paddingTop: 2 }}>
          © {new Date().getFullYear()} Bykreator Studio · Sva prava zadržana
        </p>

      </div>
    </div>
  )
}
