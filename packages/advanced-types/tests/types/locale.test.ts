import { m } from '../../src/index'
import { fc as gen } from '@fast-check/vitest'
import { testTypeEncodingAndDecoding } from '@mondrian-framework/model/src/test-helpers'
import { describe } from 'vitest'

const knownInvalidValues = [10, true, null, undefined, '', 'It ', 'IT', 'iT', 'it ', 'Italian', 'en-us', 'en-US']
const invalidValues = gen.string().filter((value) => !knownValidValues.includes(value))
// prettier-ignore
const knownValidValues = [
  "ab", "aa", "af", "ak", "sq", "am", "ar", "an", "hy", "as", "av", "ae", "ay", "az", "bm", "ba", "eu", "be", "bn",
  "bh", "bi", "bs", "br", "bg", "my", "ca", "ch", "ce", "ny", "zh", "cv", "kw", "co", "cr", "hr", "cs", "da", "dv",
  "nl", "dz", "en", "eo", "et", "ee", "fo", "fj", "fi", "fr", "ff", "gl", "ka", "de", "el", "gn", "gu", "ht", "ha",
  "he", "hz", "hi", "ho", "hu", "ia", "id", "ie", "ga", "ig", "ik", "io", "is", "it", "iu", "ja", "jv", "kl", "kn",
  "kr", "ks", "kk", "km", "ki", "rw", "ky", "kv", "kg", "ko", "ku", "kj", "la", "lb", "lg", "li", "ln", "lo", "lt",
  "lu", "lv", "gv", "mk", "mg", "ms", "ml", "mt", "mi", "mr", "mh", "mn", "na", "nv", "nb", "nd", "ne", "ng", "nn",
  "no", "ii", "nr", "oc", "oj", "cu", "om", "or", "os", "pa", "pi", "fa", "pl", "ps", "pt", "qu", "rm", "rn", "ro",
  "ru", "sa", "sc", "sd", "se", "sm", "sg", "sr", "gd", "sn", "si", "sk", "sl", "so", "st", "az", "es", "su", "sw",
  "ss", "sv", "ta", "te", "tg", "th", "ti", "bo", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty", "ug", "uk",
  "ur", "uz", "ve", "vi", "vo", "wa", "cy", "wo", "fy", "xh", "yi", "yo", "za", "zu", 
]

describe(
  'standard property based tests',
  testTypeEncodingAndDecoding(m.locale, {
    knownValidValues,
    knownInvalidValues,
    invalidValues,
  }),
)
