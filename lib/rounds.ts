export type RoundQ = { q: string; options: string[] }
export type Round = { level: number; title: string; blurb: string; qs: RoundQ[] }

// The vibe check draws 3 questions from this pool. The draw is fixed per match (seeded by the match id),
// so both people always get the same 3. Do not reorder or edit existing entries once real matches exist,
// because stored answers are positions in these lists. Add new questions at the end only.
export const POOL: RoundQ[] = [
  { q: 'Be honest, what are you in the mood for right now?', options: ['Something sweet', 'Something spicy', 'Something cheesy', 'Honestly, just good company'] },
  { q: "Pick the movie we'd actually \"watch\"", options: ['Something scary, so I can grab your arm', 'A rom-com, no judging', 'A comedy we talk over', "Whatever's on, we'd barely watch it"] },
  { q: "You're planning our first date. Where are we going?", options: ['Somewhere with amazing food', 'Somewhere with a view', 'Somewhere loud where we laugh the whole time', 'A surprise, you would have to trust me'] },
  { q: "It's 1 AM and you text me. What does it say?", options: ["\"Can't sleep. Talk to me.\"", "\"I'm starving. Come with me.\"", 'A random meme', '"You up?"'] },
  { q: 'Who cracks first?', options: ["Me, I'm bold", "You, I'll make it easy", 'Whoever blinks first', "We'd both just keep staring"] },
  { q: 'What gets your attention first?', options: ['The smile', 'The eyes', 'The confidence', 'The sense of humor'] },
  { q: 'Rainy day, no plans.', options: ['Blanket, movie, and you', 'A long walk in the rain', 'Bake something and make a mess', 'Ignore the world, stay in'] },
  { q: "At a party, you're usually...", options: ['Pulling people onto the dance floor', 'Deep in a corner conversation', 'Making eye contact across the room', 'Telling the story everyone remembers'] },
  { q: "Be honest, you'd steal their...", options: ['Hoodie', 'Fries', 'Playlist', 'Last slice of pizza'] },
  { q: 'Voice note or text?', options: ['Voice note, I want to hear you', "Text, I'm smoother in writing", 'Just call me', "Memes, that's our language"] },
  { q: 'What makes you lose track of time?', options: ['A great conversation', 'Dancing', 'A late-night food run', 'Someone worth staying up for'] },
  { q: 'Stuck in an elevator for an hour. What are we doing?', options: ['Playing 20 questions', 'Telling embarrassing stories', "Guessing each other's type", 'Honestly, not complaining'] },
]

export const ROUND_SIZE = 3

// Small deterministic shuffle so a given match always gets the same questions.
export function pickQuestions(matchId: string): RoundQ[] {
  let h = 2166136261
  for (let i = 0; i < matchId.length; i++) { h ^= matchId.charCodeAt(i); h = Math.imul(h, 16777619) }
  const rand = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
  const idx = POOL.map((_, i) => i)
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  return idx.slice(0, ROUND_SIZE).map(i => POOL[i])
}

export const ROUNDS: Round[] = [
  { level: 1, title: 'Vibe check', blurb: 'Three picks. Ten seconds.', qs: [] },
]

export const SKIP_LABEL = 'Skip'
