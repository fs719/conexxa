export type Icebreaker = { q: string; options: string[] }

export const CASUAL: Icebreaker[] = [
  { q: 'Your flirting style?', options: ['Teasing', 'Compliments', 'Eye contact, no words', 'Memes only'] },
  { q: 'What gets my attention fastest?', options: ['A good laugh', 'Confidence', 'Great style', 'Someone who texts back'] },
  { q: 'Who texts first?', options: ['Me, always', 'You, I will wait', 'Whoever is braver', 'Coin flip'] },
  { q: 'Pick our first meet', options: ['Coffee run', 'Late night food', 'Walk around campus', 'Something chaotic'] },
  { q: 'Red flag you would forgive?', options: ['Bad music taste', 'Always late', 'Steals your fries', 'Leaves you on read for an hour'] },
  { q: 'Pineapple on pizza?', options: ['Yes, always', 'Never', 'Only on a dare', 'I will eat anything'] },
  { q: 'Best way to break the ice?', options: ['A bad pickup line', 'A random question', 'A meme', 'A compliment'] },
  { q: 'It counts as a date when...', options: ['Someone pays', 'There is a second one', 'You hold hands', 'Honestly, vibes'] },
]

export const SERIOUS: Icebreaker[] = [
  { q: 'What wins me over?', options: ['Making me laugh', 'Being genuinely kind', 'Making the first move', 'Really listening'] },
  { q: 'Perfect first date?', options: ['Coffee and a long talk', 'Dinner somewhere cute', 'Something outdoors', 'Cooking together'] },
  { q: 'Green flag?', options: ['Remembers small details', 'Introduces me to friends', 'Plans ahead', 'Makes me laugh at 2am'] },
  { q: 'Texting when you like someone?', options: ['All day', 'Short and sweet', 'Voice notes', 'Memes only'] },
  { q: 'A perfect Sunday together?', options: ['Brunch', 'Long walk', 'Cooking at home', 'Movie in, phones away'] },
  { q: 'Your love language?', options: ['Words', 'Quality time', 'Little surprises', 'Acts of service'] },
]

const LEGACY_CASUAL: Icebreaker[] = [
  { q: 'Pineapple on pizza: Yes or no?', options: ['Yes, always', 'No, never', 'Only on a dare', "I'll eat anything"] },
  { q: 'Pick your karaoke move', options: ['Power ballad', 'Throwback pop', 'Rap verse', 'I only watch'] },
  { q: 'Would you rather fight 100 duck-sized horses or one horse-sized duck?', options: ['100 duck-sized horses', 'One horse-sized duck', "Neither, I'm running", 'Negotiate with the duck'] },
  { q: "What's your guilty pleasure?", options: ['Reality TV', 'Rom-coms', 'Fast food at midnight', 'Scrolling for hours'] },
  { q: 'Perfect weekend?', options: ['Out with friends', 'Cozy night in', 'Spontaneous road trip', 'Sleeping in all day'] },
]

const LEGACY_SERIOUS: Icebreaker[] = [
  { q: 'What matters most in a relationship?', options: ['Honesty', 'Humor', 'Loyalty', 'Ambition'] },
  { q: 'How do you handle disagreements?', options: ['Talk it out right away', 'Take space, then talk', 'Find a quick compromise', 'Write it down first'] },
  { q: 'Where do you see yourself in five years?', options: ['Building my career', 'In grad school', 'Traveling the world', 'Still figuring it out'] },
  { q: 'Ideal first date?', options: ['Dinner and conversation', 'Outdoor adventure', 'Museum or show', 'Cooking together'] },
  { q: 'Biggest priority right now?', options: ['School', 'Career', 'Friendships', 'Personal growth'] },
]


export const optionsFor = (q: string): string[] =>
  [...CASUAL, ...SERIOUS, ...LEGACY_CASUAL, ...LEGACY_SERIOUS].find(i => i.q === q)?.options || ['Yes', 'No']
