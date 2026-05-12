type Member = { id: string; name: string; avatar_url?: string | null }

export default function MemberPicker({
  members,
  value,
  onChange,
  label = 'Ko plaća?',
}: {
  members: Member[]
  value: string
  onChange: (id: string) => void
  label?: string
}) {
  if (members.length === 0) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {members.map(m => {
          const active = value === m.id
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--text-1)' : 'var(--border)'}`,
                background: active ? 'var(--text-1)' : 'transparent',
                color: active ? '#fff' : 'var(--text-3)',
                transition: 'all 0.15s',
              }}
            >
              {m.avatar_url ? (
                <img
                  src={m.avatar_url}
                  alt={m.name}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', objectFit: 'cover',
                    border: active ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                  }}
                />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: active ? 'rgba(255,255,255,0.2)' : 'var(--border-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#fff' : 'var(--text-3)', lineHeight: 1 }}>
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {m.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
