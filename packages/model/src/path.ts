import { areSameArray } from './utils'

/**
 * TODO: add doc to whole module
 */
export type Fragment =
  | { kind: 'field'; fieldName: string }
  | { kind: 'index'; index: number }
  | { kind: 'variant'; variantName: string }

export const empty: () => Path = () => new PathImpl([])
export const fromFragments: (fragments: Fragment[]) => Path = (fragments) => new PathImpl(fragments)

export interface Path {
  prependField(fieldName: string): Path
  prependIndex(index: number): Path
  prependVariant(variantName: string): Path
  toArray(): Fragment[]
  format(): string
  equals(other: Path): boolean
}

class PathImpl implements Path {
  fragments: Fragment[]

  constructor(fragments: Fragment[]) {
    this.fragments = fragments
  }

  prependFragment = (fragment: Fragment) => new PathImpl([fragment, ...this.fragments])
  prependField = (fieldName: string) => this.prependFragment({ kind: 'field', fieldName })
  prependIndex = (index: number) => this.prependFragment({ kind: 'index', index })
  prependVariant = (variantName: string) => this.prependFragment({ kind: 'variant', variantName })
  toArray = () => [...this.fragments]

  format = () => {
    let pieces = ['$']
    for (let i = 0; i < this.fragments.length; i++) {
      const fragment = this.fragments[i]
      pieces.push(fragmentToSeparator(fragment), fragmentToString(fragment))
    }
    return pieces.join('')
  }

  equals(other: Path): boolean {
    return this === other || areSameArray(other.toArray(), this.toArray(), areFragmentsEqual)
  }
}

function areFragmentsEqual(one: Fragment, other: Fragment): boolean {
  return (
    (one.kind === 'field' && other.kind === 'field' && one.fieldName === other.fieldName) ||
    (one.kind === 'index' && other.kind === 'index' && one.index === other.index) ||
    (one.kind === 'variant' && other.kind === 'variant' && one.variantName === other.variantName)
  )
}

function fragmentToString(fragment: Fragment): string {
  switch (fragment.kind) {
    case 'field':
      return fragment.fieldName
    case 'index':
      return `[${fragment.index.toString()}]`
    case 'variant':
      return fragment.variantName
  }
}

function fragmentToSeparator(lookahead: Fragment): string {
  switch (lookahead.kind) {
    case 'field':
      return '.'
    case 'index':
      return ''
    case 'variant':
      return '.'
  }
}

export type WithPath<Data extends Record<string, any>> = Data & { path: Path }

/**
 * Utility function to prepend a prefix to the path of a `decoder.Error`.
 */
export function prependField<Data extends Record<string, any>, T extends WithPath<Data>>(
  value: T,
  fieldName: string,
): T {
  return { ...value, path: value.path.prependField(fieldName) }
}

/**
 * Utility function to prepend an index to the path of a `decoder.Error`.
 */
export function prependIndex<Data extends Record<string, any>, T extends WithPath<Data>>(value: T, index: number): T {
  return { ...value, path: value.path.prependIndex(index) }
}

/**
 * Utility function to prepend a variant to the path of a `decoder.Error`.
 */
export function prependVariant<Data extends Record<string, any>, T extends WithPath<Data>>(
  value: T,
  variantName: string,
): T {
  return { ...value, path: value.path.prependVariant(variantName) }
}
