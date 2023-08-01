import { fc } from '@fast-check/vitest'
import { m } from '@mondrian-framework/advanced-types'
import { types } from '@mondrian-framework/model'

type Arbitrary<T extends types.CustomType<any, any, any>> = T extends types.CustomType<
  any,
  infer Options,
  infer InferredAs
>
  ? (options?: Options) => fc.Arbitrary<InferredAs>
  : never

export const date: Arbitrary<m.DateType> = (options) =>
  fc.date({ min: options?.minimum, max: options?.maximum }).map((d) => {
    const date = new Date(d)
    date.setUTCHours(0, 0, 0, 0)
    return date
  })

export const ipv4: Arbitrary<m.IPType> = () =>
  fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
    )
    .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

export const latitude: Arbitrary<m.LatitudeType> = () =>
  fc.double({ min: -90, max: 90 }).map((v) => Number.parseFloat(v.toFixed(8)))

export const longitude: Arbitrary<m.LongitudeType> = () =>
  fc.double({ min: -180, max: 180 }).map((v) => Number.parseFloat(v.toFixed(8)))

export const port: Arbitrary<m.PortType> = () => fc.integer({ min: 1, max: 65535 })

export const url: Arbitrary<m.URLType> = () => fc.webUrl().map((u) => new URL(u))
