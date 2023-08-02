import { arbitrary } from '../src'
import { fc } from '@fast-check/vitest'
import t from '@mondrian-framework/advanced-types'
import m, { decoder, encoder, types } from '@mondrian-framework/model'
import { expect, test } from 'vitest'

test('fromType', () => {
  const jwtLoginType = m.object({ sub: m.string(), name: m.string(), iat: m.integer() })
  const myType = () =>
    m.object({
      //base
      number: m
        .integer({ multipleOf: 15, minimum: [3, 'inclusive'], maximum: [90, 'exclusive'] })
        .nullable()
        .optional(),
      string: m
        .string({ regex: /^abc-.*-xyz$/, minLength: 10, maxLength: 100 })
        .nullable()
        .optional(),
      boolean: m.boolean().nullable().optional(),
      null: m.literal(null),
      array: m.array(m.number(), { minItems: 5, maxItems: 10 }),
      enum: m.enumeration(['A', 'B']),
      union: m.union({ a: m.literal('A'), b: m.literal('B') }, { a: (v) => v === 'A', b: (v) => v === 'B' }),
      emptyObject: m.object({}),
      object: m.object({ a: m.literal(true).optional() }),

      //custom
      unknown: m.unknown(),
      datetime: m.dateTime({ minimum: new Date(123), maximum: new Date(123000) }),
      timestamp: m.timestamp({ minimum: new Date(123), maximum: new Date(123000) }),
      countryCode: t.countryCode(),
      currency: t.currency(),
      date: t.date(),
      email: t.email(),
      ip: t.ip(),
      isbn: t.isbn(),
      loginJwt: t.jwt('login', jwtLoginType, 'secret'),
      nullJwt: t.jwt('null', m.object({ a: m.literal(null) }), 'secret'),
      coordinates: m.object({ longitude: t.longitude(), latitude: t.latitude() }).array(),
      locale: t.locale(),
      mac: t.mac(),
      phonenumber: t.phoneNumber(),
      port: t.port(),
      rgb: t.rgb(),
      rgba: t.rgba(),
      time: t.time(),
      timezone: t.timezone(),
      url: t.url(),
      uuid: t.uuid(),
      version: t.version(),

      self: m.reference(m.nullable(myType)),
    })

  const myArbitrary = arbitrary.fromType({
    type: myType,
    customArbitraries: {
      IP: arbitrary.custom.ip,
      latitude: arbitrary.custom.latitude,
      longitude: arbitrary.custom.longitude,
      date: arbitrary.custom.date,
      port: arbitrary.custom.port,
      URL: arbitrary.custom.url,
      MAC: arbitrary.custom.mac,
      RGB: arbitrary.custom.rgb,
      RGBA: arbitrary.custom.rbga,
      version: arbitrary.custom.version,
      'phone-number': arbitrary.custom.phoneNumber,
      ISBN: arbitrary.custom.isbn,
      timezone: arbitrary.custom.timezone,
      email: () => fc.emailAddress(),
      unknown: () => fc.anything(),
      datetime: (options) => fc.date({ min: options?.minimum, max: options?.maximum }),
      timestamp: (options) => fc.date({ min: options?.minimum, max: options?.maximum }),
      time: () => fc.date(),
      UUID: () => fc.uuid(),
      'login-jwt': () => arbitrary.fromType({ type: jwtLoginType }),
      'null-jwt': () => fc.constant({ a: null }),
    },
    maxDepth: 3,
  })

  const property = fc.property(myArbitrary, (v) => {
    const encoded = encoder.encode(myType, v)
    const decode = decoder.decode(myType, encoded)
    if (!decode.success) {
      console.log(decode)
    }
    expect(decode.success).toBe(true)
  })
  fc.assert(property)
})

test('randomType', () => {
  const property = fc.property(arbitrary.type(), (type) => {
    const property2 = fc.property(arbitrary.fromType({ type }), (value) => {
      const encoded = encoder.encode(type, value)
      const decode = decoder.decode(type, encoded)
      if (!decode.success) {
        console.log(decode)
      }
      expect(decode.success).toBe(true)
    })
    fc.assert(property2, { numRuns: 10 })
  })
  fc.assert(property, { numRuns: 10000 })
})
