export type Icebreaker = { q: string; options: string[] }

export const CASUAL: Icebreaker[] = [
  { q: 'Pineapple on pizza: Yes or no?', options: ['Yes, always', 'No, never', 'Only on a dare', "I'll eat anything"] },
  { q: 'Pick your karaoke move', options: ['Power ballad', 'Throwback pop', 'Rap verse', 'I only watch'] },
  { q: 'Would you rather fight 100 duck-sized horses or one horse-sized duck?', options: ['100 duck-sized horses', 'One horse-sized duck', "Neither, I'm running", 'Negotiate with the duck'] },
  { q: "What's your guilty pleasure?", options: ['Reality TV', 'Rom-coms', 'Fast food at midnight', 'Scrolling for hours'] },
  { q: 'Perfect weekend?', options: ['Out with friends', 'Cozy night in', 'Spontaneous road trip', 'Sleeping in all day'] },
]

export const SERIOUS: Icebreaker[] = [
  { q: 'What matters most in a relationship?', options: ['Honesty', 'Humor', 'Loyalty', 'Ambition'] },
  { q: 'How do you handle disagreements?', options: ['Talk it out right away', 'Take space, then talk', 'Find a quick compromise', 'Write it down first'] },
  { q: 'Where do you see yourself in five years?', options: ['Building my career', 'In grad school', 'Traveling the world', 'Still figuring it out'] },
  { q: 'Ideal first date?', options: ['Dinner and conversation', 'Outdoor adventure', 'Museum or show', 'Cooking together'] },
  { q: 'Biggest priority right now?', options: ['School', 'Career', 'Friendships', 'Personal growth'] },
]

export const optionsFor = (q: string): string[] =>
  [...CASUAL, ...SERIOUS].find(i => i.q === q)?.options || ['Yes', 'No']
