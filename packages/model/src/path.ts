/**
 * a string representation of the given path following the {@link https://goessner.net/articles/JsonPath/index.html#e2 xpath} notation
 * */
export type Path = string

/**
 * @returns an empty path
 */
export function root(): Path {
  return '$'
}

/**
 * @returns a path of this field name
 */
export function ofField(fieldName: string): Path {
  return appendField(root(), fieldName)
}

/**
 * @returns a path of this index
 */
export function ofIndex(index: number): Path {
  return appendIndex(root(), index)
}

/**
 * @returns the given path with the appended fieldName
 */
export function appendField(path: Path, fieldName: string): Path {
  return `${path}.${fieldName}`
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
  return `${root()}.${fieldName}${path.substring(1, path.length)}`
}

/**
 * @returns the given path with the appended index
 */
export function prependIndex(path: Path, index: number): Path {
  return `${root()}[${index}]${path.substring(1, path.length)}`
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
