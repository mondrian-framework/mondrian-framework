import { m } from '../../src/index'
import { testTypeDecodingAndEncoding } from './property-helper'
import BigNumber from 'bignumber.js'
import { describe } from 'vitest'

describe(
  'standard property based tests 1',
  testTypeDecodingAndEncoding(
    m.decimal({ decimals: 2, base: 10, minimum: 0, maximum: new BigNumber('12342314231423142134124.24') }),
    {
      validValues: [
        {
          raw: '123.123',
          decoded: new BigNumber('123.12'),
          encoded: '123.12',
        },
        {
          raw: '-0.001',
          decoded: new BigNumber('-0'),
          encoded: '0',
        },
        {
          raw: '0',
          decoded: new BigNumber(0),
          encoded: '0',
        },
        {
          raw: '12342314231423142134124.23',
          decoded: new BigNumber('12342314231423142134124.23'),
          encoded: '12342314231423142134124.23',
        },
      ],
      invalidValues: [null, 'fgsf', true, -5, '-0.01', '12342314231423142134124.25'],
    },
    {
      typeCastingStrategy: 'tryCasting',
    },
  ),
)

describe(
  'standard property based tests 2',
  testTypeDecodingAndEncoding(
    m.decimal({ decimals: 2, base: 16, exclusiveMinimum: 0, exclusiveMaximum: 200 }),
    {
      validValues: [
        {
          raw: 'F',
          decoded: new BigNumber(15),
          encoded: 'f',
        },
      ],
      invalidValues: [0, '123.123', 200],
    },
    {
      typeCastingStrategy: 'expectExactTypes',
    },
  ),
)

describe(
  'standard property based tests 3',
  testTypeDecodingAndEncoding(
    m.decimal({ base: 10, multipleOf: 5 }),
    {
      validValues: [
        {
          raw: '25',
          decoded: new BigNumber(25),
          encoded: '25',
        },
      ],
      invalidValues: [1, 2, -24, 5.0001, '5.000000001'],
    },
    {
      typeCastingStrategy: 'expectExactTypes',
    },
  ),
)
