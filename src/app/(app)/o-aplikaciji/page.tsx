import Link from 'next/link'

const VERSION = '0.1.0'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 16, padding: '20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em', marginBottom: 12 }}>{title}</p>
      <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.65 }}>
        {children}
      </div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 10 }}>{children}</p>
}

function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
      {items.map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
    </ul>
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

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ background: 'var(--card)', borderRadius: 16, padding: '28px 18px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}>
          <p style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-1)', marginBottom: 6 }}>Štediša</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Verzija {VERSION}</p>
          <p style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 14, lineHeight: 1.6 }}>
            Porodična aplikacija za praćenje finansija — troškovi, štednja, pozajmice, čekovi i mesečni računi, sve na jednom mestu.
          </p>
        </div>

        <Section title="USLOVI KORIŠĆENJA">
          <P>Korišćenjem aplikacije Štediša prihvatate sledeće uslove:</P>
          <UL items={[
            'Aplikacija je namenjena isključivo za lično i porodično upravljanje finansijama.',
            'Korisnik je odgovoran za tačnost unetih podataka.',
            'Aplikacija ne pruža finansijske savete niti preporuke za ulaganje.',
            'Korisnik je odgovoran za čuvanje pristupnih podataka svog naloga.',
            'Zabranjeno je korišćenje aplikacije za nezakonite aktivnosti.',
            'Zadržavamo pravo izmene uslova uz prethodnu obavest korisnicima.',
          ]} />
          <P>Ukoliko se ne slažete sa uslovima, prestanite sa korišćenjem aplikacije i obrišite nalog u podešavanjima.</P>
        </Section>

        <Section title="POLITIKA PRIVATNOSTI">
          <P><strong>Koji podaci se prikupljaju</strong></P>
          <UL items={[
            'Email adresa i podaci o nalogu (za autentifikaciju)',
            'Finansijski podaci koje sami unosite (troškovi, prihodi, štednja itd.)',
            'Podaci o uređaju i sesijama (za sigurnost i otklanjanje grešaka)',
          ]} />
          <P><strong>Kako koristimo podatke</strong></P>
          <UL items={[
            'Podaci se koriste isključivo za pružanje funkcija aplikacije.',
            'Ne delimo vaše podatke sa trećim stranama.',
            'Podaci se čuvaju na sigurnoj infrastrukturi (Supabase / PostgreSQL).',
          ]} />
          <P><strong>Vaša prava</strong></P>
          <UL items={[
            'Možete obrisati nalog i sve povezane podatke u podešavanjima aplikacije.',
            'Možete nas kontaktirati za pitanja u vezi privatnosti na: contact@bykreator.com',
          ]} />
          <P>Aplikacija Štediša ne koristi podatke u reklamne svrhe niti ih prodaje trećim licima.</P>
        </Section>

        <Section title="NAPRAVLJENO OD STRANE">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>Bykreator Studio</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Design & development studio</p>
            </div>
            <a
              href="https://bykreator.com/rs"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 13, fontWeight: 500, color: 'var(--accent)',
                textDecoration: 'none', padding: '8px 14px',
                background: 'var(--accent-subtle)',
                borderRadius: 10,
              }}
            >
              bykreator.com/rs
            </a>
          </div>
        </Section>

        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginTop: 4 }}>
          © {new Date().getFullYear()} Bykreator Studio. Sva prava zadržana.
        </p>

      </div>
    </div>
  )
}
