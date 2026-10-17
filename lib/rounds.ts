export type RoundQ = { q: string; options: string[] }
export type Round = { level: number; title: string; blurb: string; qs: RoundQ[] }

export const ROUNDS: Round[] = [
  {
    level: 1, title: 'Fun', blurb: 'Easy warm-up. Five quick picks.',
    qs: [
      { q: 'Ideal Friday night?', options: ['A party', 'Dinner out', 'Movie night in', 'Games or sports'] },
      { q: 'Texting style?', options: ['Instant replies', 'Within the hour', 'Whenever I see it', 'I just call'] },
      { q: 'Coffee order?', options: ['Iced, always', 'Hot and plain', 'Sweet and fancy', 'I skip coffee'] },
      { q: 'Pick a trip', options: ['Beach', 'City', 'Mountains', 'Staying home'] },
      { q: 'Morning or night?', options: ['Early bird', 'Night owl', 'Depends on the day', 'Sleeping all day'] },
    ],
  },
  {
    level: 2, title: 'Flirty', blurb: 'A little more spark. Skip anything you want.',
    qs: [
      { q: 'First date vibe?', options: ['Dinner and drinks', 'Coffee and a walk', 'Something adventurous', 'Skip'] },
      { q: 'Best compliment to get?', options: ['Your smile', 'Your humor', 'Your style', 'Your brain'] },
      { q: 'How fast do you move?', options: ['Slow burn', 'Go with the flow', 'I know in a week', 'Skip'] },
      { q: 'Pick a date move', options: ['Hold hands', 'Sit close', 'Borrow a hoodie', 'Plan date two early'] },
      { q: 'What gets your attention first?', options: ['Eyes', 'Confidence', 'Humor', 'Voice'] },
    ],
  },
  {
    level: 3, title: 'Real talk', blurb: 'What you actually want. Last round.',
    qs: [
      { q: 'What are you looking for right now?', options: ['Something serious', 'Something casual', 'Seeing what happens', 'Not sure yet'] },
      { q: 'Love language?', options: ['Words', 'Time together', 'Small gifts', 'Physical touch'] },
      { q: 'Biggest dealbreaker?', options: ['Dishonesty', 'Rudeness', 'No ambition', 'Bad communication'] },
      { q: 'After graduation?', options: ['Stay in DC', 'Move cities', 'Grad school', 'Not sure yet'] },
      { q: 'Ready to take this off the app?', options: ['Yes, let us swap', 'Maybe soon', 'Meet first', 'Keep chatting here'] },
    ],
  },
]

export const SKIP_LABEL = 'Skip'
