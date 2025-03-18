import { useEffect, useRef } from 'react'

interface Track {
  artist: string
  track: string
  lyrics: string[]
}

export const tracks: Track[] = [
  {
    artist: 'Björk',
    track: 'Army of Me',
    lyrics: [
      'Stand up',
      "You've got to manage",
      "I won't sympathize",
      'Anymore',
      'And if you complain once more',
      "You'll meet an army of me",
      'And if you complain once more',
      "You'll meet an army of me",
      "You're alright",
      "There's nothing wrong",
      'Self-sufficience, please!',
      'And get to work',
      'And if you complain once more',
      "You'll meet an army of me",
      'And if you complain once more',
      "You'll meet an army of me, army of me",
      "You're on your own now",
      "We won't save you",
      'Your rescue squad',
      'Is too exhausted',
      'And if you complain once more',
      "You'll meet an army of me",
      'And if you complain once more',
      "You'll meet an army of me",
      'And if you complain once more',
      "You'll meet an army of me",
      'And if you complain once more',
      "You'll meet an army of me, army of me"
    ]
  },
  {
    artist: 'Björk',
    track: "It's Oh So Quiet",
    lyrics: [
      "It's oh, so quiet, Shhhh, shhhh",
      "It's oh, so still, Shhhh, shhhh",
      "You're all alone, Shhhh, shhhh",
      'And so peaceful until',
      'You fall in love',
      'Zing, boom',
      'The sky up above',
      'Zing, boom',
      'Is caving in',
      'Wow, bam!',
      "You've never been so nuts about a guy",
      'You wanna laugh, you wanna cry',
      'You cross your heart and hope to die',
      "Till it's over, and then, Shhhh, shhhh",
      "It's nice and quiet, Shhhh, shhhh",
      'But soon again, Shhhh, shhhh',
      'Starts another big riot',
      'You blow a fuse',
      'Zing, boom',
      'The devil cuts loose',
      'Zing, boom',
      "So what's the use",
      'Wow, bam!',
      'Of falling in love?',
      "It's oh, so quiet",
      "It's oh, so still",
      "You're all alone",
      'And so peaceful until',
      'You ring the bell',
      'Bim bam',
      'You shout and you yell',
      'Hi ho-ho',
      'You broke the spell',
      'Gee, this is swell, you almost have a fit',
      'This guy is “gorge”, and I got hit',
      "There's no mistake, this is it!",
      "Till it's over, and then",
      "It's nice and quiet, Shhhh, shhhh",
      'But soon again, Shhhh, shhhh',
      'Starts another big riot',
      'You blow a fuse',
      'Zing, boom',
      'The devil cuts loose',
      'Zing, boom',
      "So what's the use",
      'Wow, bam!',
      'Of falling in love?',
      'The sky caves in',
      'The devil cuts loose',
      'You blow, blow, blow, blow, blow your fuse',
      'Aaaaah!',
      'When you fall in love',
      'Ssshhhhhh'
    ]
  },
  {
    artist: 'Pink Floyd',
    track: 'Shine On You Crazy Diamond',
    lyrics: [
      'Remember when you were young',
      'You shone like the Sun',
      'Shine on, you crazy diamond',
      "Now there's a look in your eyes",
      'Like black holes in the sky',
      'Shine on, you crazy diamond',
      'You were caught in the crossfire of childhood and stardom',
      'Blown on the steel breeze',
      'Come on, you target for faraway laughter',
      'Come on, you stranger, you legend, you martyr, and shine',
      'See upcoming rock shows',
      'Get tickets for your favorite artists',
      'You might also like',
      'The Tortured Poets Department',
      'Taylor Swift',
      'But Daddy I Love Him',
      'Taylor Swift',
      'So Long, London',
      'Taylor Swift',
      'You reached for the secret too soon',
      'You cried for the Moon',
      'Shine on, you crazy diamond',
      'Threatened by shadows at night',
      'And exposed in the light',
      'Shine on (Shine on), you crazy diamond (You crazy diamond)',
      'Well, you wore out your welcome with random precision',
      'Rode on the steel breeze',
      'Come on, you raver, you seer of visions',
      'Come on, you painter, you piper, you prisoner, and shine',
      'Nobody knows where you are',
      'How near or how far',
      'Shine on, you crazy diamond',
      'Pile on many more layers',
      "And I'll be joining you there",
      'Shine on, you crazy diamond',
      "And we'll bask in the shadow of yesterday's triumph",
      'And sail on the steel breeze',
      'Come on, you boy child, you winner and loser',
      'Come on, you miner for truth and delusion, and shine!'
    ]
  }
]

export const LyricDisplay = ({ track = tracks[0] }: { track: Track }) => {
  const idx = useRef(0)
  const topClass = 'top-0 opacity-100 absolute text-gray-400 h-6'
  const bottomClass = 'top-10 opacity-0 absolute text-gray-400 h-6'

  const a = useRef<HTMLSpanElement>(null)
  const b = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const lyrics = track.lyrics

      if (!a.current || !b.current || !lyrics.length) return

      idx.current = (idx.current + 1) % lyrics.length

      if (idx.current % 2 === 0) {
        a.current.className = topClass
        b.current.className = bottomClass
        // set a's inner text immediately
        a.current.innerText = lyrics[idx.current]

        // set a's later to prevent flash
        setTimeout(() => {
          if (!b.current) return
          b.current.innerText = lyrics[(idx.current + 1) % lyrics.length]
        }, 500)
      } else {
        b.current.className = topClass
        a.current.className = bottomClass

        // set b's inner text immediately
        b.current.innerText = lyrics[idx.current]

        // set b's later to prevent flash
        setTimeout(() => {
          if (!a.current) return
          a.current.innerText = lyrics[(idx.current + 1) % lyrics.length]
        }, 500)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full h-11/12 bg-white flex items-center justify-left p-2">
      <div className="h-8 relative overflow-hidden">
        <div className="*:transition-all *:duration-500">
          <span ref={a} className={`${topClass} `}>
            {track.lyrics[idx.current]}
          </span>
          <span ref={b} className={`${bottomClass} `}>
            {track.lyrics[(idx.current + 1) % track.lyrics.length]}
          </span>
        </div>
        <div className="text-gray-300 text-xs top-4 relative bg-white">
          {track.artist} - {track.track}
        </div>
      </div>
    </div>
  )
}
