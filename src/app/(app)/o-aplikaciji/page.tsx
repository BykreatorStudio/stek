import Link from 'next/link'
import { Logomark, Wordmark } from '@/components/ui/AuthLogo'

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

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: 14, ...style }}>
      {children}
    </p>
  )
}

function FeatureRow({ icon, title, desc, last }: { icon: React.ReactNode; title: string; desc: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingBottom: last ? 0 : 16, marginBottom: last ? 0 : 16, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: '#C8FF31', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55 }}>{desc}</p>
      </div>
    </div>
  )
}

function Icon({ d, d2 }: { d: string; d2?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1D200F" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      {d2 && <path d={d2} />}
    </svg>
  )
}

function DataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, paddingBottom: last ? 0 : 12, marginBottom: last ? 0 : 12, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', flexShrink: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', textAlign: 'right', lineHeight: 1.5 }}>{value}</p>
    </div>
  )
}

export default function OAplikacijiPage() {
  return (
    <div>
      <div style={{ background: 'var(--header-bg)', padding: '24px 20px 28px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/vise" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 4px 0', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--header-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <p style={{ fontSize: 18, fontWeight: 500, color: 'var(--header-text)' }}>O aplikaciji</p>
          </div>
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
          <SectionLabel>ŠTA SVE MOŽEŠ</SectionLabel>

          <FeatureRow
            icon={<Icon d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />}
            title="Prihodi i rashodi"
            desc="Unosi transakcije po kategorijama i grupama, vidiš ko je šta potrošio i zarađivao svaki mesec."
          />
          <FeatureRow
            icon={<Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />}
            title="Analitika"
            desc="Grafici prihoda i rashoda po mesecima, pregled po kategorijama i grupama, trend štednje."
          />
          <FeatureRow
            icon={<Icon d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />}
            title="Mesečne obaveze"
            desc="Fiksni i varijabilni računi, krediti, čekovi i pozajmice — sa statusom plaćanja za svaki mesec."
          />
          <FeatureRow
            icon={<Icon d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />}
            title="Krediti"
            desc="Praćenje svih kredita — iznos rate, preostali dug, rok i ukupno stanje."
          />
          <FeatureRow
            icon={<Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
            title="Štednja"
            desc="Više sefova za različite namene — gotovina, banka, devize. Svaki saldira posebno."
          />
          <FeatureRow
            icon={<Icon d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />}
            title="Pozajmice"
            desc="Ko kome duguje — i vi drugima i drugi vama. Sa statusom izmirenja i istorijom."
          />
          <FeatureRow
            icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
            title="Čekovi"
            desc="Evidencija čekova sa rokovima naplate i statusom isplate."
          />
          <FeatureRow
            last
            icon={<Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />}
            title="Push notifikacije"
            desc="Obaveštenja za nadolazeće račune i rokove — svako podešava šta želi da prima."
          />
        </Card>

        {/* AI */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionLabel style={{ marginBottom: 0 }}>AI ASISTENT</SectionLabel>
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
          <SectionLabel>PRIVATNOST I PODACI</SectionLabel>
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
          <SectionLabel>TEHNOLOGIJA</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
            {['Next.js 15', 'Supabase', 'PostgreSQL', 'Vercel', 'Recharts', 'Web Push API'].map(name => (
              <span key={name} style={{ fontSize: 12, fontWeight: 500, color: '#1D200F', background: '#C8FF31', padding: '5px 12px', borderRadius: 20 }}>
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
          <SectionLabel>USLOVI KORIŠĆENJA</SectionLabel>
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

        {/* Bykreator */}
        <Card>
          <SectionLabel>NAPRAVLJENO OD STRANE</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>Bykreator Studio</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Design & development studio</p>
            </div>
            <a
              href="https://bykreator.com/rs"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 500, color: '#1D200F', textDecoration: 'none', padding: '8px 14px', background: '#C8FF31', borderRadius: 10 }}
            >
              bykreator.com/rs
            </a>
          </div>
        </Card>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', paddingTop: 4 }}>
          © {new Date().getFullYear()} Bykreator Studio · Sva prava zadržana
        </p>

      </div>
    </div>
  )
}
