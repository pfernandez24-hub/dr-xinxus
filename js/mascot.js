// Dr.Xinxus: un pingüino (como Tux) con gafas, espejo de médico y un prompt en la barriga.
// mood: 'normal' | 'happy' | 'sad' | 'wow' | 'think'
export function mascot(mood = 'normal', size = 96) {
  const eyes = {
    normal: `<circle cx="47" cy="44" r="4.2" fill="#0b1118"/><circle cx="73" cy="44" r="4.2" fill="#0b1118"/>
             <circle cx="48.4" cy="42.6" r="1.4" fill="#fff"/><circle cx="74.4" cy="42.6" r="1.4" fill="#fff"/>`,
    happy: `<path d="M41.5 46 q5.5 -7 11 0" stroke="#0b1118" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path d="M67.5 46 q5.5 -7 11 0" stroke="#0b1118" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    sad: `<circle cx="47" cy="47" r="3.8" fill="#0b1118"/><circle cx="73" cy="47" r="3.8" fill="#0b1118"/>
          <path d="M40 36 l10 3" stroke="#0b1118" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M80 36 l-10 3" stroke="#0b1118" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M80 52 q2 5 0 7 q-2 -2 0 -7z" fill="#5ec8ff"/>`,
    wow: `<circle cx="47" cy="44" r="5.5" fill="#0b1118"/><circle cx="73" cy="44" r="5.5" fill="#0b1118"/>
          <circle cx="49" cy="42" r="2" fill="#fff"/><circle cx="75" cy="42" r="2" fill="#fff"/>`,
    think: `<circle cx="49" cy="42" r="4" fill="#0b1118"/><circle cx="75" cy="42" r="4" fill="#0b1118"/>
            <path d="M66 35 l12 -2" stroke="#0b1118" stroke-width="2.4" stroke-linecap="round"/>`,
  }[mood] || '';
  return `<svg class="mascot mascot-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Dr.Xinxus">
    <ellipse cx="60" cy="112" rx="30" ry="4" fill="#000" opacity=".25"/>
    <ellipse cx="44" cy="106" rx="11" ry="5" fill="#ff9f1a"/>
    <ellipse cx="76" cy="106" rx="11" ry="5" fill="#ff9f1a"/>
    <path d="M60 10 C30 10 22 38 22 62 C22 92 36 106 60 106 C84 106 98 92 98 62 C98 38 90 10 60 10Z" fill="#1d2b3a"/>
    <path d="M24 64 C14 70 12 82 18 86 C22 80 26 74 28 70Z" fill="#1d2b3a"/>
    <path d="M96 64 C106 70 108 82 102 86 C98 80 94 74 92 70Z" fill="#1d2b3a"/>
    <path d="M60 32 C40 32 33 52 33 70 C33 92 44 101 60 101 C76 101 87 92 87 70 C87 52 80 32 60 32Z" fill="#f4f7fa"/>
    <ellipse cx="60" cy="45" rx="25" ry="15" fill="#f4f7fa"/>
    <rect x="44" y="72" width="32" height="18" rx="4" fill="#0b1118"/>
    <text x="48" y="85.5" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700" fill="#58cc02">&gt;_</text>
    <path d="M24 26 C40 16 80 16 96 26" stroke="#7a8a99" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="19" r="8.5" fill="#cfd8e0" stroke="#7a8a99" stroke-width="2"/>
    <circle cx="60" cy="19" r="3.2" fill="#1d2b3a"/>
    <path d="M55 15 a6 6 0 0 1 5 -3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${eyes}
    <circle cx="47" cy="44" r="9" fill="none" stroke="#2b3a48" stroke-width="2.4"/>
    <circle cx="73" cy="44" r="9" fill="none" stroke="#2b3a48" stroke-width="2.4"/>
    <path d="M56 44 h8" stroke="#2b3a48" stroke-width="2.4"/>
    <ellipse cx="39" cy="57" rx="4.5" ry="2.6" fill="#ff8fab" opacity=".55"/>
    <ellipse cx="81" cy="57" rx="4.5" ry="2.6" fill="#ff8fab" opacity=".55"/>
    <path d="M53 54 Q60 50 67 54 Q60 ${mood === 'happy' || mood === 'wow' ? 66 : 60} 53 54Z" fill="#ff9f1a" stroke="#e07f00" stroke-width="1"/>
  </svg>`;
}
