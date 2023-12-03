/**
 * The options that can be used when encoding a type:
 * - `sensitiveInformationStrategy` its possible values are:
 *   - `"hide"`: any type marked as sensitive will be encoded as a null
 *   - `"keep"`: will encode any sensitive type leaving it unchanged
 */
export type Options = {
  readonly sensitiveInformationStrategy?: 'hide' | 'keep'
}

export const defaultOptions: Required<Options> = {
  sensitiveInformationStrategy: 'keep',
}
