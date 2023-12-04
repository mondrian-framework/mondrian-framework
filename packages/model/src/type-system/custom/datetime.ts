import { model, decoding, validation } from '../../index'
import gen from 'fast-check'

/**
 * The type of a datetime, defined as a custom type.
 */
export type DateTimeType = model.CustomType<'datetime', DateTimeOptions, Date>

/**
 * Additional options for the DateTime CustomType
 */
export type DateTimeOptions = { minimum?: Date; maximum?: Date }

/**
 * @param options the options used to create the new datetime custom type
 * @returns a {@link CustomType `CustomType`} representing a datetime
 */
export function datetime(options?: model.OptionsOf<DateTimeType>): DateTimeType {
  //TODO [Good first issue]: check options validity
  return model.custom({
    typeName: 'datetime',
    encoder,
    decoder,
    validator: buildValidator(options),
    arbitrary,
    options,
  })
}

function encoder(date: Date): string {
  return date.toISOString()
}

function decoder(
  value: unknown,
  decodingOptions: Required<decoding.Options>,
  _options?: model.OptionsOf<DateTimeType>,
): decoding.Result<Date> {
  if (value instanceof Date) {
    return decoding.succeed(value)
  } else if (typeof value === 'string' && decodingOptions.typeCastingStrategy === 'expectExactTypes') {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? decoding.fail('ISO date', value) : decoding.succeed(date)
  } else if (
    (typeof value === 'number' || typeof value === 'string') &&
    decodingOptions.typeCastingStrategy === 'tryCasting'
  ) {
    return tryMakeDate(value)
  }
  return decoding.fail('ISO date', value)
}

function buildValidator(options?: model.OptionsOf<DateTimeType>) {
  const { maximum, minimum } = options ?? {}
  return validation.buildValidator<Date>(
    //prettier-ignore
    {
      ...(maximum ? { [`Datetime must be maximum ${maximum.toISOString()}`]: (date) => Number.isNaN(date.valueOf()) || date.getTime() > maximum.getTime() } : {}),
      ...(minimum ? { [`Datetime must be minimum ${minimum.toISOString()}`]: (date) => Number.isNaN(date.valueOf()) || date.getTime() < minimum.getTime() } : {}),
    },
  )
}

function tryMakeDate(value: number | string): decoding.Result<Date> {
  const time = Number(value)
  let date: Date
  if (!Number.isNaN(time)) {
    date = new Date(time)
  } else {
    date = new Date(value)
  }
  return Number.isNaN(date.valueOf()) ? decoding.fail('ISO date', value) : decoding.succeed(date)
}

function arbitrary(_maxDepth: number, options?: model.DateTimeOptions): gen.Arbitrary<Date> {
  return gen.date({ min: options?.minimum, max: options?.maximum })
}
