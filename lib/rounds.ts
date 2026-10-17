export type RoundQ = { q: string; options: string[] }
export type Round = { level: number; title: string; blurb: string; qs: RoundQ[] }

export const ROUNDS: Round[] = [
  {
    level: 1, title: 'Vibe check', blurb: 'Three picks. Ten seconds.',
    qs: [
      { q: 'Ideal Friday night?', options: ['A party', 'Dinner out', 'Movie night in', 'Games or sports'] },
      { q: 'First date vibe?', options: ['Dinner and drinks', 'Coffee and a walk', 'Something adventurous', 'Netflix and talk'] },
      { q: 'How fast do you move?', options: ['Slow burn', 'Sparks fast', 'Depends on the person', 'Go with the flow'] },
    ],
  },
]

export const SKIP_LABEL = 'Skip'
