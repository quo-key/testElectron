import React, { useEffect, useState } from 'react'

const CHINESE_SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

function getBeijingParts() {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })
  const parts = fmt.formatToParts(now)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type && p.value) map[p.type] = p.value
  }

  const year = map.year || String(now.getFullYear())
  const month = map.month || String(now.getMonth() + 1)
  const day = map.day || String(now.getDate())
  const hour = Number(map.hour ?? String(now.getHours()))
  const minute = map.minute || String(now.getMinutes()).padStart(2, '0')
  const second = map.second || String(now.getSeconds()).padStart(2, '0')

  const shichenIndex = Math.floor(((hour + 1) % 24) / 2)
  const shichen = CHINESE_SHICHEN[shichenIndex] || ''

  return { year, month, day, hour, minute, second, shichen }
}

export function useBeijingTime() {
  const [t, setT] = useState(() => getBeijingParts())
  useEffect(() => {
    const id = setInterval(() => setT(getBeijingParts()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

export default function BeijingClock(): JSX.Element {
  const t = useBeijingTime()
  const hh = String(t.hour).padStart(2, '0')
  const mm = String(t.minute).padStart(2, '0')
  const ss = String(t.second).padStart(2, '0')
  return (
    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', marginRight: 8 }} title={`北京时间 ${t.year}-${t.month}-${t.day} ${hh}:${mm}:${ss}`}>
      {t.year}年{t.month}月{t.day}日 {hh}:{mm}:{ss} ({t.shichen}时)
    </div>
  )
}
