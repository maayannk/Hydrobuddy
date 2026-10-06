/**
 * The selectable buddies. All characters are original artwork (inline SVG, 120x140).
 *
 * Every SVG follows the same conventions so the shared CSS can animate it:
 *   <g class="eyes">       blinks
 *   <g class="arm-right">  waves
 * Gradient ids are prefixed with the mascot id so several can sit on one page.
 */

export interface Mascot {
  id: string;
  name: string;
  /** Short style label shown in pickers. */
  theme: string;
  description: string;
  /** Speech-bubble lines; one is picked at random per reminder. */
  lines: string[];
  svg: string;
}

const EYE = '#1b2a41';

function svg(id: string, label: string, body: string): string {
  return `<svg class="buddy buddy-${id}" viewBox="0 0 120 140" role="img" aria-label="${label}">${body}</svg>`;
}

const drip: Mascot = {
  id: 'drip',
  name: 'Drip',
  theme: 'Classic',
  description: 'The original droplet buddy.',
  lines: [
    "💧 It's water time! Take a sip.",
    'Hydration check! Time for a sip.',
    'Your code compiles better when you are hydrated.',
  ],
  svg: svg('drip', 'Drip the droplet', `
  <defs><linearGradient id="drip-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8fd8ff"/><stop offset="100%" stop-color="#2f8cf0"/></linearGradient></defs>
  <path d="M22 92 Q8 86 10 72" stroke="#2f8cf0" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm-right"><path d="M98 92 Q114 84 110 68" stroke="#2f8cf0" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  <path d="M60 6 C60 6 18 58 18 90 A42 42 0 0 0 102 90 C102 58 60 6 60 6 Z" fill="url(#drip-g)"/>
  <ellipse cx="42" cy="66" rx="7" ry="12" fill="#fff" opacity="0.45" transform="rotate(-20 42 66)"/>
  <g class="eyes"><ellipse cx="46" cy="92" rx="5" ry="7" fill="${EYE}"/><ellipse cx="74" cy="92" rx="5" ry="7" fill="${EYE}"/><circle cx="48" cy="89" r="1.8" fill="#fff"/><circle cx="76" cy="89" r="1.8" fill="#fff"/></g>
  <ellipse cx="36" cy="104" rx="6" ry="3.5" fill="#ff8fab" opacity="0.7"/><ellipse cx="84" cy="104" rx="6" ry="3.5" fill="#ff8fab" opacity="0.7"/>
  <path d="M52 106 Q60 114 68 106" stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
};

const hero: Mascot = {
  id: 'hero',
  name: 'Captain Hydro',
  theme: 'Superhero',
  description: 'A caped crusader who never lets a teammate go thirsty.',
  lines: [
    'Every hero needs a refill. Sip up!',
    'With great code comes great thirst.',
    'Heroes, assemble… around the water cooler!',
    'Not all heroes wear capes. The hydrated ones do.',
  ],
  svg: svg('hero', 'Captain Hydro', `
  <defs><linearGradient id="hero-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7cc8ff"/><stop offset="100%" stop-color="#1f6fd1"/></linearGradient></defs>
  <path d="M36 70 Q8 118 16 136 L104 136 Q112 118 84 70 Z" fill="#e63946"/>
  <path d="M24 98 Q10 104 14 118" stroke="#1f6fd1" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm-right"><path d="M96 92 Q110 74 106 56" stroke="#1f6fd1" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="106" cy="52" r="6" fill="#e63946"/></g>
  <path d="M60 10 C60 10 22 60 22 92 A38 38 0 0 0 98 92 C98 60 60 10 60 10 Z" fill="url(#hero-g)"/>
  <ellipse cx="44" cy="62" rx="6" ry="11" fill="#fff" opacity="0.45" transform="rotate(-20 44 62)"/>
  <path d="M28 86 Q60 74 92 86 L90 99 Q60 89 30 99 Z" fill="${EYE}"/>
  <g class="eyes"><ellipse cx="46" cy="90" rx="6" ry="4.5" fill="#fff"/><ellipse cx="74" cy="90" rx="6" ry="4.5" fill="#fff"/><circle cx="47" cy="90" r="2.4" fill="${EYE}"/><circle cx="75" cy="90" r="2.4" fill="${EYE}"/></g>
  <path d="M53 104 Q60 110 67 104" stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="60" cy="119" r="9" fill="#ffd166" stroke="#e63946" stroke-width="2"/>
  <path d="M56 114 V124 M64 114 V124 M56 119 H64" stroke="#e63946" stroke-width="2.4" stroke-linecap="round"/>`),
};

const splashy: Mascot = {
  id: 'splashy',
  name: 'Splashy',
  theme: 'Pocket monster',
  description: 'A wild water-type critter. It evolves when you drink water.',
  lines: [
    'Splashy used HYDRATE! It is super effective!',
    'A wild glass of water appeared!',
    'Splashy is evolving… into a hydrated developer!',
    'Your HP is low. Drink a potion (of water).',
  ],
  svg: svg('splashy', 'Splashy the water critter', `
  <defs><radialGradient id="splashy-g" cx="0.4" cy="0.35" r="0.75"><stop offset="0%" stop-color="#9be7f7"/><stop offset="100%" stop-color="#2fa8d5"/></radialGradient></defs>
  <path d="M92 108 Q118 106 112 84 Q106 68 96 78 Q106 82 100 92" stroke="#1f86b0" stroke-width="6" fill="none" stroke-linecap="round"/>
  <path d="M40 62 L28 26 L58 52 Z" fill="#1f86b0"/><path d="M80 62 L92 26 L62 52 Z" fill="#1f86b0"/>
  <path d="M40 58 L34 38 L50 52 Z" fill="#9be7f7"/><path d="M80 58 L86 38 L70 52 Z" fill="#9be7f7"/>
  <ellipse cx="45" cy="124" rx="10" ry="6" fill="#1f86b0"/><ellipse cx="75" cy="124" rx="10" ry="6" fill="#1f86b0"/>
  <path d="M26 92 Q14 92 14 80" stroke="#1f86b0" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm-right"><path d="M94 92 Q106 86 106 74" stroke="#1f86b0" stroke-width="7" fill="none" stroke-linecap="round"/></g>
  <circle cx="60" cy="88" r="37" fill="url(#splashy-g)"/>
  <ellipse cx="60" cy="102" rx="21" ry="16" fill="#d4f4fb"/>
  <path d="M60 56 C60 56 54 64 54 67 A6 6 0 0 0 66 67 C66 64 60 56 60 56 Z" fill="#fff" opacity="0.85"/>
  <g class="eyes"><ellipse cx="46" cy="84" rx="6.5" ry="8.5" fill="${EYE}"/><ellipse cx="74" cy="84" rx="6.5" ry="8.5" fill="${EYE}"/><circle cx="48.5" cy="80.5" r="2.4" fill="#fff"/><circle cx="76.5" cy="80.5" r="2.4" fill="#fff"/></g>
  <ellipse cx="35" cy="96" rx="5.5" ry="3.5" fill="#ff8fab" opacity="0.75"/><ellipse cx="85" cy="96" rx="5.5" ry="3.5" fill="#ff8fab" opacity="0.75"/>
  <path d="M54 96 Q57 100 60 96 Q63 100 66 96" stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`),
};

const ember: Mascot = {
  id: 'ember',
  name: 'Ember',
  theme: 'Fantasy dragon',
  description: 'A tiny dragon from a land of thrones and long winters. Even dragons hydrate.',
  lines: [
    'Water is coming. Take a sip.',
    'Even dragons drink before they breathe fire.',
    'A coder who drinks water is ready for any battle.',
    'The night is long and full of bugs. Hydrate first.',
  ],
  svg: svg('ember', 'Ember the dragon', `
  <defs><linearGradient id="ember-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7fd6a0"/><stop offset="100%" stop-color="#2e9e64"/></linearGradient></defs>
  <path d="M38 88 L6 52 L16 80 L2 76 L22 104 Z" fill="#1f6e47"/><path d="M82 88 L114 52 L104 80 L118 76 L98 104 Z" fill="#1f6e47"/>
  <path d="M78 122 Q108 132 110 110" stroke="#2e9e64" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M104 108 L118 100 L114 116 Z" fill="#1f6e47"/>
  <ellipse cx="60" cy="108" rx="29" ry="25" fill="url(#ember-g)"/>
  <ellipse cx="60" cy="112" rx="17" ry="16" fill="#f4d58d"/>
  <path d="M54 100 H66 M53 108 H67 M54 116 H66" stroke="#e0b860" stroke-width="2" stroke-linecap="round"/>
  <path d="M40 50 L32 26 L50 44 Z" fill="#f4d58d"/><path d="M80 50 L88 26 L70 44 Z" fill="#f4d58d"/>
  <path d="M28 106 Q16 110 18 122" stroke="#2e9e64" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm-right"><path d="M88 104 Q102 98 102 88" stroke="#2e9e64" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M102 68 C102 68 95 77 95 81 A7 7 0 0 0 109 81 C109 77 102 68 102 68 Z" fill="#5ec8ff"/></g>
  <ellipse cx="60" cy="70" rx="31" ry="26" fill="url(#ember-g)"/>
  <ellipse cx="60" cy="82" rx="15" ry="9" fill="#9ee6bb"/>
  <circle cx="55" cy="81" r="1.8" fill="${EYE}"/><circle cx="65" cy="81" r="1.8" fill="${EYE}"/>
  <g class="eyes"><ellipse cx="46" cy="66" rx="5.5" ry="7" fill="${EYE}"/><ellipse cx="74" cy="66" rx="5.5" ry="7" fill="${EYE}"/><circle cx="48" cy="63" r="2" fill="#fff"/><circle cx="76" cy="63" r="2" fill="#fff"/></g>
  <ellipse cx="36" cy="76" rx="5" ry="3" fill="#ff8fab" opacity="0.7"/><ellipse cx="84" cy="76" rx="5" ry="3" fill="#ff8fab" opacity="0.7"/>
  <path d="M53 88 Q60 93 67 88" stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <ellipse cx="45" cy="128" rx="9" ry="5" fill="#1f6e47"/><ellipse cx="75" cy="128" rx="9" ry="5" fill="#1f6e47"/>`),
};

const duck: Mascot = {
  id: 'duck',
  name: 'Quackers',
  theme: 'Rubber duck',
  description: 'Your rubber-duck debugging partner. Explain the bug, then drink some water.',
  lines: [
    'Quack! Rubber-duck debugging works better when you are hydrated.',
    'Explain your bug to me… right after a sip of water.',
    'Step 1: drink water. Step 2: explain the bug. Step 3: fixed.',
  ],
  svg: svg('duck', 'Quackers the rubber duck', `
  <defs><linearGradient id="duck-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe066"/><stop offset="100%" stop-color="#ffc300"/></linearGradient></defs>
  <path d="M10 130 Q24 124 38 130 T66 130 T94 130 T122 130" stroke="#5ec8ff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M28 104 Q8 86 30 88 Z" fill="#ffc300"/>
  <ellipse cx="60" cy="106" rx="40" ry="24" fill="url(#duck-g)"/>
  <circle cx="62" cy="66" r="27" fill="url(#duck-g)"/>
  <ellipse cx="54" cy="56" rx="6" ry="9" fill="#fff" opacity="0.4" transform="rotate(-25 54 56)"/>
  <path d="M84 68 Q106 64 104 73 Q98 82 82 78 Z" fill="#ff8c42"/>
  <path d="M86 75 Q96 76 101 73" stroke="#d96a1f" stroke-width="1.6" fill="none"/>
  <g class="eyes"><ellipse cx="56" cy="62" rx="4.5" ry="6" fill="${EYE}"/><ellipse cx="74" cy="62" rx="4.5" ry="6" fill="${EYE}"/><circle cx="57.5" cy="59.5" r="1.7" fill="#fff"/><circle cx="75.5" cy="59.5" r="1.7" fill="#fff"/></g>
  <ellipse cx="48" cy="74" rx="5" ry="3" fill="#ff8fab" opacity="0.7"/>
  <g class="arm-right"><path d="M56 102 Q76 88 92 102 Q76 114 56 102 Z" fill="#f5b700"/></g>`),
};

const robot: Mascot = {
  id: 'robot',
  name: 'Bit',
  theme: 'Robot',
  description: 'A friendly bot that monitors your coolant levels.',
  lines: [
    'BEEP BOOP. Coolant level low. Refill required.',
    'SYSTEM ALERT: hydration below threshold.',
    '01010111 = W. W is for Water.',
    'Scheduled maintenance: drink water. Downtime: 10 seconds.',
  ],
  svg: svg('robot', 'Bit the robot', `
  <line x1="60" y1="20" x2="60" y2="34" stroke="#8a9bb0" stroke-width="3"/>
  <circle cx="60" cy="17" r="5" fill="#ff6b6b"/>
  <path d="M36 98 Q22 106 26 120" stroke="#8a9bb0" stroke-width="7" fill="none" stroke-linecap="round"/>
  <g class="arm-right"><path d="M84 98 Q100 90 100 76" stroke="#8a9bb0" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="100" cy="72" r="5.5" fill="#cfd8e3" stroke="#8a9bb0" stroke-width="2"/></g>
  <rect x="32" y="34" width="56" height="44" rx="12" fill="#e3e9f0" stroke="#8a9bb0" stroke-width="2"/>
  <rect x="40" y="42" width="40" height="28" rx="7" fill="${EYE}"/>
  <g class="eyes"><rect x="47" y="49" width="8" height="10" rx="3" fill="#5ef0ff"/><rect x="65" y="49" width="8" height="10" rx="3" fill="#5ef0ff"/></g>
  <path d="M53 63 Q60 67 67 63" stroke="#5ef0ff" stroke-width="2" fill="none" stroke-linecap="round"/>
  <rect x="54" y="78" width="12" height="6" fill="#8a9bb0"/>
  <rect x="36" y="84" width="48" height="40" rx="10" fill="#e3e9f0" stroke="#8a9bb0" stroke-width="2"/>
  <rect x="47" y="93" width="26" height="20" rx="4" fill="#fff" stroke="#8a9bb0" stroke-width="1.5"/>
  <rect x="49" y="102" width="22" height="9" rx="2" fill="#5ec8ff"/>
  <circle cx="42" cy="118" r="2" fill="#ff6b6b"/><circle cx="78" cy="118" r="2" fill="#2ea043"/>
  <rect x="40" y="124" width="14" height="8" rx="3" fill="#8a9bb0"/><rect x="66" y="124" width="14" height="8" rx="3" fill="#8a9bb0"/>`),
};

const cat: Mascot = {
  id: 'cat',
  name: 'Mochi',
  theme: 'Dev cat',
  description: 'Sits on your keyboard until you drink water.',
  lines: [
    '*pushes your glass of water closer* Drink it.',
    'Meow. You have been staring at code too long. Sip.',
    'I sat on your keyboard so you would take a water break.',
  ],
  svg: svg('cat', 'Mochi the cat', `
  <defs><linearGradient id="cat-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8b878"/><stop offset="100%" stop-color="#ee8d47"/></linearGradient></defs>
  <path d="M86 120 Q116 118 108 88" stroke="#ee8d47" stroke-width="8" fill="none" stroke-linecap="round"/>
  <ellipse cx="60" cy="110" rx="30" ry="22" fill="url(#cat-g)"/>
  <ellipse cx="60" cy="114" rx="16" ry="14" fill="#ffe8d1"/>
  <path d="M34 62 L36 32 L58 50 Z" fill="#ee8d47"/><path d="M86 62 L84 32 L62 50 Z" fill="#ee8d47"/>
  <path d="M38 56 L40 40 L51 50 Z" fill="#ffb3c1"/><path d="M82 56 L80 40 L69 50 Z" fill="#ffb3c1"/>
  <g class="arm-right"><path d="M84 106 Q98 98 96 86" stroke="#ee8d47" stroke-width="8" fill="none" stroke-linecap="round"/></g>
  <circle cx="60" cy="74" r="29" fill="url(#cat-g)"/>
  <path d="M54 47 L56 56 M60 46 V56 M66 47 L64 56" stroke="#d9702c" stroke-width="3" stroke-linecap="round"/>
  <g class="eyes"><ellipse cx="48" cy="74" rx="5" ry="7" fill="${EYE}"/><ellipse cx="72" cy="74" rx="5" ry="7" fill="${EYE}"/><circle cx="49.5" cy="71" r="1.8" fill="#fff"/><circle cx="73.5" cy="71" r="1.8" fill="#fff"/></g>
  <path d="M57 83 H63 L60 87 Z" fill="#e76f51"/>
  <path d="M60 87 Q56 92 52 89 M60 87 Q64 92 68 89" stroke="${EYE}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M30 82 L44 84 M30 88 L44 87 M90 82 L76 84 M90 88 L76 87" stroke="#b5651d" stroke-width="1.4" stroke-linecap="round"/>
  <ellipse cx="40" cy="86" rx="4.5" ry="2.8" fill="#ff8fab" opacity="0.6"/><ellipse cx="80" cy="86" rx="4.5" ry="2.8" fill="#ff8fab" opacity="0.6"/>`),
};

export const MASCOTS: readonly Mascot[] = [drip, hero, splashy, ember, duck, robot, cat];

/** Setting value that picks a different buddy for every reminder. */
export const RANDOM_MASCOT = 'random';

export function getMascot(id: string | undefined): Mascot {
  return MASCOTS.find((m) => m.id === id) ?? drip;
}

export function isMascotChoice(id: unknown): id is string {
  return id === RANDOM_MASCOT || MASCOTS.some((m) => m.id === id);
}

/** Resolve a setting value to a concrete buddy ("random" picks one). */
export function resolveMascot(choice: string, rand: () => number = Math.random): Mascot {
  if (choice === RANDOM_MASCOT) {
    return MASCOTS[Math.floor(rand() * MASCOTS.length)] ?? drip;
  }
  return getMascot(choice);
}

/** Short developer one-liners shown under the speech bubble. */
export const DEV_LINES: readonly string[] = [
  'while (coding) { sip(); }',
  'git commit -m "hydrated"',
  'if (thirsty) return water;',
  '// TODO: drink water',
  'npm install hydration',
  'try { code(); } finally { drinkWater(); }',
  'hydration.level = "full";',
  'brain.cache.clear(); water.sip();',
];

export function pick<T>(items: readonly T[], rand: () => number = Math.random): T {
  return items[Math.floor(rand() * items.length)];
}
