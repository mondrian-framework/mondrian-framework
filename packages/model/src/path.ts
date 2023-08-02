export type Path = Fragment[]

export type Fragment =
  | { kind: 'field'; fieldName: string }
  | { kind: 'index'; index: number }
  | { kind: 'variant'; variantName: string }

export const empty: () => Path = () => []

export function prependFragment(path: Path, fragment: Fragment): Path {
  return [fragment, ...path]
}

export function prependField(path: Path, fieldName: string): Path {
  return prependFragment(path, { kind: 'field', fieldName })
}

export function prependIndex(path: Path, index: number): Path {
  return prependFragment(path, { kind: 'index', index })
}

export function prependVariant(path: Path, variantName: string): Path {
  return prependFragment(path, { kind: 'variant', variantName })
}

export function prettyPrint(path: Path): string {
  let pieces = ['$']
  for (let i = 0; i < path.length; i++) {
    const fragment = path[i]
    const lookahead = path.at(i + 1)
    pieces.push(fragmentToString(fragment, lookahead))
  }
  return pieces.join('.')
}

function fragmentToString(fragment: Fragment, lookahead?: Fragment): string {
  const separator = lookaheadToSeparator(lookahead)
  switch (fragment.kind) {
    case 'field':
      return fragment.fieldName + separator
    case 'index':
      return `[${fragment.index.toString()}]` + separator
    case 'variant':
      return fragment.variantName + separator
  }
}

function lookaheadToSeparator(lookahead: Fragment | undefined): string {
  if (lookahead) {
    switch (lookahead.kind) {
      case 'field':
        return '.'
      case 'index':
        return ''
      case 'variant':
        return '.'
    }
  } else {
    return ''
  }
}
