/**
 * Renders maths text, stacking any fraction it contains.
 *
 * Fractions travel through the app as plain strings — `"3/4"`, `"1 3/4"` —
 * so that parsing, grading and every existing test work on ordinary text. This
 * is the one place that turns that string into something that looks like a
 * fraction, because inline `3/4` is not how a fraction is written and reads as
 * a division.
 */

const FRACTION = /(-?)(\d+)\/(\d+)/g

type Piece =
  | { kind: 'text'; value: string }
  | { kind: 'fraction'; sign: string; num: string; den: string }

/** Split text into runs of plain characters and complete fractions. */
function parse(text: string): Piece[] {
  const pieces: Piece[] = []
  let cursor = 0

  for (const match of text.matchAll(FRACTION)) {
    const at = match.index ?? 0
    if (at > cursor) pieces.push({ kind: 'text', value: text.slice(cursor, at) })
    pieces.push({ kind: 'fraction', sign: match[1], num: match[2], den: match[3] })
    cursor = at + match[0].length
  }

  // Anything left over, including a half-typed "3/" the learner is still on.
  if (cursor < text.length) pieces.push({ kind: 'text', value: text.slice(cursor) })
  return pieces
}

export function Maths({ text, className = '' }: { text: string; className?: string }) {
  const pieces = parse(text)

  return (
    <span className={`inline-flex items-center justify-center gap-1 ${className}`}>
      {pieces.map((piece, i) =>
        piece.kind === 'text' ? (
          <span key={i} className="whitespace-pre">{piece.value}</span>
        ) : (
          <span key={i} className="inline-flex items-center">
            {/* The sign sits outside the stack, as it is written. */}
            {piece.sign && <span aria-hidden>−</span>}
            <span
              data-fraction
              className="inline-flex flex-col items-center leading-none"
              // Read aloud as a fraction rather than as two loose numbers.
              aria-label={`${piece.sign ? 'negative ' : ''}${piece.num} over ${piece.den}`}
              role="math"
            >
              <span data-part className="px-1">{piece.num}</span>
              <span className="my-0.5 h-px w-full bg-current" aria-hidden />
              <span data-part className="px-1">{piece.den}</span>
            </span>
          </span>
        ),
      )}
    </span>
  )
}
