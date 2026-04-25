import { useState } from 'react'
import StatusBar from '../components/StatusBar'
import { currentUser } from '../data/mockData'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const [notifs, setNotifs] = useState({ bday: true, invites: true, messages: false })

  const toggle = key => setNotifs(n => ({ ...n, [key]: !n[key] }))

  const Toggle = ({ on, onToggle }) => (
    <div onClick={onToggle} style={{
      width: 51, height: 31, borderRadius: 20, position: 'relative', flexShrink: 0, cursor: 'pointer',
      background: on ? 'linear-gradient(135deg,#e055aa,#f5a623)' : '#E5E5EA',
      transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: 3, width: 25, height: 25, background: '#fff',
        borderRadius: '50%', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        left: on ? 'auto' : 3, right: on ? 3 : 'auto',
        transition: 'all 0.2s',
      }}/>
    </div>
  )

  const sections = [
    {
      title: 'Intégrations',
      rows: [
        { icon: '📅', label: 'Google Calendar', desc: 'Non connecté', arrow: true },
        { icon: '🍎', label: 'Apple Calendar', desc: 'Non connecté', arrow: true },
      ],
    },
    {
      title: 'Notifications',
      rows: [
        { icon: '🔔', label: "Rappels d'anniversaire", desc: '7 jours avant les anniversaires', toggle: 'bday' },
        { icon: '✉️', label: 'Nouvelles invitations', desc: 'Activé', toggle: 'invites' },
        { icon: '💬', label: 'Messages', desc: notifs.messages ? 'Activé' : 'Désactivé', toggle: 'messages' },
      ],
    },
    {
      title: 'Compte',
      rows: [
        { icon: '🔒', label: 'Confidentialité', arrow: true },
        { icon: '🚪', label: 'Se déconnecter', arrow: true, danger: true, onClick: () => supabase.auth.signOut() },
      ],
    },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F2F2F7', overflow: 'hidden' }}>
      <StatusBar />
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: -0.4, color: '#1C1C1E', marginBottom: 16, padding: '6px 2px 0' }}>Profil</div>

        {/* Profile card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 18, marginBottom: 6, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#e055aa,#f5a623)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            {currentUser.emoji}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1C1C1E' }}>{currentUser.name}</div>
            <div style={{ fontSize: 13, color: '#8E8E93', margin: '3px 0 2px' }}>{currentUser.email}</div>
            <div style={{ fontSize: 12, color: '#AEAEB2' }}>{currentUser.since}</div>
          </div>
        </div>

        <div style={{ padding: '10px 0 16px' }}>
          <div style={{
            width: '100%', padding: 14, background: '#1C1C1E', color: '#fff',
            borderRadius: 12, fontSize: 15, fontWeight: 600, textAlign: 'center', cursor: 'pointer',
          }}>
            Modifier mon profil
          </div>
        </div>

        {sections.map(sec => (
          <div key={sec.title} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1C1C1E', padding: '0 2px', marginBottom: 10 }}>{sec.title}</div>
            <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.07)' }}>
              {sec.rows.map((row, i) => (
                <div key={i} onClick={row.onClick} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', cursor: row.onClick ? 'pointer' : 'default',
                  borderBottom: i < sec.rows.length - 1 ? '0.5px solid rgba(0,0,0,0.08)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
                      background: row.danger ? 'rgba(255,59,48,0.10)' : 'rgba(124,92,191,0.10)',
                    }}>
                      {row.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: row.danger ? '#FF3B30' : '#1C1C1E' }}>{row.label}</div>
                      {row.desc && <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 1 }}>{row.desc}</div>}
                    </div>
                  </div>
                  {row.toggle && <Toggle on={notifs[row.toggle]} onToggle={() => toggle(row.toggle)}/>}
                  {row.arrow && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#AEAEB2" strokeWidth="2.2" strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
