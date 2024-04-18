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

/**
 * Fills the given options with the default values for the missing fields.
 */
export function fillOptions(options: Options | undefined): Required<Options> {
  if (options?.sensitiveInformationStrategy != null) {
    return options as Required<Options>
  }
  return defaultOptions
}
