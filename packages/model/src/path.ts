import { areSameArray, assertNever } from './utils'

/**
 * The type of a fragment composing a path in a mondrian type. It can either be:
 *  - `Field`: if it denotes the field of an object
 *  - `Index`: if it denotes an index used to access an array
 *  - `Variant`: if it denotes one of the variants of a tagged union
 */
export type Fragment =
  | { kind: 'field'; fieldName: string }
  | { kind: 'index'; index: number }
  | { kind: 'variant'; variantName: string }

/**
 * @returns an empty path (that is, a path that is composed of no fragments)
 */
export const empty: () => Path = () => new PathImpl([])

/**
 * @param fragments the fragments composing the path
 * @returns a new {@link Path path} composed of the given fragments
 */
export const fromFragments: (fragments: readonly Fragment[]) => Path = (fragments) => new PathImpl(fragments)

/**
 * A path that can be used to locate an element of a mondrian type.
 * @example consider the following definition:
 *          ```ts
 *          const model = types.object({
 *            values: types.number().array()
 *          })
 *          ```
 *          A possible value of that type could be:
 *          ```ts
 *          const value = { values: [1, 2, 3] }
 *          ```
 *          And the path corresponding to the value `1` of the field `values` would be:
 *          ```ts
 *          const p = path.empty().appendField("values").appendIndex(0)
 *          // p.format() -> "$.values[0]"
 *          ```
 */
export interface Path {
  /**
   * @param fieldName the field to be prepended to the path
   * @returns a new {@link Path path} with the prepended field. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.prependField("prepended").format()
   *          // -> $.prepended.field
   *          ```
   */
  prependField(fieldName: string): Path

  /**
   * @param fieldName the field to be appended to the path
   * @returns a new {@link Path path} with the appended field. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.appendField("appended").format()
   *          // -> $.field.appended
   *          ```
   */
  appendField(fieldName: string): Path

  /**
   * @param index the index to be prepended to the path
   * @returns a new {@link Path path} with the prepended index. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.prependIndex(1).format()
   *          // -> $[1].field
   *          ```
   */
  prependIndex(index: number): Path

  /**
   * @param index the index to be appended to the path
   * @returns a new {@link Path path} with the appended index. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.appendIndex(1).format()
   *          // -> $.field[1]
   *          ```
   */
  appendIndex(index: number): Path

  /**
   * @param variantName the variant to be prepended to the path
   * @returns a new {@link Path path} with the prepended variant. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.prependVariant("prepended").format()
   *          // -> $.prepended.field
   *          ```
   */
  prependVariant(variantName: string): Path

  /**
   * @param variantName the variant to be appended to the path
   * @returns a new {@link Path path} with the appended variant. The previous path is not updated in place
   * @example ```ts
   *          const p = path.empty().appendField("field")
   *          p.appendVariant("appended").format()
   *          // -> $.field.appended
   *          ```
   */
  appendVariant(variantName: string): Path

  /**
   * @returns an array of the {@link Fragment fragments} composing the path
   * @example ```ts
   *          path.empty().appendIndex(0).appendField("foo").toArray()
   *          // -> [{ kind: "index", index: 0 }, { kind: "field", fieldName: "foo" }]
   *          ```
   */
  toArray(): readonly Fragment[]

  /**
   * @returns a string representation of the given path following the
   *          {@link https://goessner.net/articles/JsonPath/index.html#e2 xpath} notation
   * @example ```ts
   *          path.empty().appendVariant("bar").appendIndex(0).appendField("foo").format()
   *          // -> "$.bar[0].foo"
   *          ```
   *          Let's try to analyze how each piece is displayed:
   *          - every path always starts with a `"$"` which represents the path's root
   *          - fields and variants are separated with a `.`, just like TypeScripts' field access notation
   *          - indices are put inside square brackets, just like TypeScripts' array indexing notation
   */
  format(): string

  /**
   * @param other the {@link Path path} to be compared
   * @returns `true` if the two paths are structurally equal: that is, if they are composed of exactly
   *          the same fragments in the same order
   */
  equals(other: Path): boolean
}

class PathImpl implements Path {
  readonly fragments: readonly Fragment[]

  constructor(fragments: readonly Fragment[]) {
    this.fragments = fragments
  }

  prependFragment = (fragment: Fragment) => new PathImpl([fragment, ...this.fragments])
  appendFragment = (fragment: Fragment) => new PathImpl([...this.fragments, fragment])
  prependField = (fieldName: string) => this.prependFragment({ kind: 'field', fieldName })
  appendField = (fieldName: string) => this.appendFragment({ kind: 'field', fieldName })
  prependIndex = (index: number) => this.prependFragment({ kind: 'index', index })
  appendIndex = (index: number) => this.appendFragment({ kind: 'index', index })
  prependVariant = (variantName: string) => this.prependFragment({ kind: 'variant', variantName })
  appendVariant = (variantName: string) => this.appendFragment({ kind: 'variant', variantName })
  toArray = () => this.fragments
  format = () => `\$${this.fragments.map(fragmentToString).join('')}`
  equals = (other: Path) => this === other || areSameArray(other.toArray(), this.toArray(), areFragmentsEqual)
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
      return `.${fragment.fieldName}`
    case 'index':
      return `[${fragment.index.toString()}]`
    case 'variant':
      return `.${fragment.variantName}`
    default:
      assertNever(fragment, 'I run into a fragment type I cannot turn into a string')
  }
}
