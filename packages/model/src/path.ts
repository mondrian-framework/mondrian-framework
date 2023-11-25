/**
 * a string representation of the given path following the {@link https://goessner.net/articles/JsonPath/index.html#e2 xpath} notation
 * */
export type Path = `$${string}`

/**
 * the root path
 */
export const root: '$' = '$'

/**
 * @returns a path of this field name
 */
export function ofField(fieldName: string): Path {
  return appendField(root, fieldName)
}

/**
 * @returns a path of this index
 */
export function ofIndex(index: number): Path {
  return appendIndex(root, index)
}

/**
 * @returns the given path with the appended fieldName
 */
export function appendField(path: Path, fieldName: string): Path {
  return `${path}${formatFieldName(fieldName)}`
}

/**
 * If field name does not have a simple syntax accessible with dot notation
 * uses index notation.
 */
function formatFieldName(fieldName: string): string {
  if (/^[a-zA-Z]([a-zA-Z]|[0-9])*$/.test(fieldName)) {
    return `.${fieldName}`
  } else {
    return `['${fieldName}']`
  }
}

/**
 * @returns the given path with the appended index
 */
export function appendIndex(path: Path, index: number): Path {
  return `${path}[${index}]`
}

/**
 * @returns the given path with the appended index
 */
export function prependField(path: Path, fieldName: string): Path {
  const pathWithoutRoot = path.substring(1, path.length)
  return `${root}${formatFieldName(fieldName)}${pathWithoutRoot}`
}

/**
 * @returns the given path with the appended index
 */
export function prependIndex(path: Path, index: number): Path {
  const pathWithoutRoot = path.substring(1, path.length)
  return `${root}[${index}]${pathWithoutRoot}`
}

/**
 * @param values an array of item that all have a `path` field
 * @param fieldName the field to prepend to the path of each item of the given array
 * @returns an array of item with the path updated with the prepended field
 */
export function prependFieldToAll<T extends { path: Path }>(values: T[], fieldName: string): T[] {
  return values.map((value) => ({ ...value, path: prependField(value.path, fieldName) }))
}

/**
 * @param values an array of item that all have a `path` field
 * @param index the index to prepend to the path of each item of the given array
 * @returns an array of item with the path updated with the prepended index
 */
export function prependIndexToAll<T extends { path: Path }>(values: T[], index: number): T[] {
  return values.map((value) => ({ ...value, path: prependIndex(value.path, index) }))
}
