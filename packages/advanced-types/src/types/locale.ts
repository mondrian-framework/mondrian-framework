import { CustomType, decode, m } from '@mondrian-framework/model'

const LOCALE_REGEX =
  /^(ab|aa|af|ak|sq|am|ar|an|hy|as|av|ae|ay|az|bm|ba|eu|be|bn|bh|bi|bs|br|bg|my|ca|ch|ce|ny|zh|cv|kw|co|cr|hr|cs|da|dv|nl|dz|en|eo|et|ee|fo|fj|fi|fr|ff|gl|ka|de|el|gn|gu|ht|ha|he|hz|hi|ho|hu|ia|id|ie|ga|ig|ik|io|is|it|iu|ja|jv|kl|kn|kr|ks|kk|km|ki|rw|ky|kv|kg|ko|ku|kj|la|lb|lg|li|ln|lo|lt|lu|lv|gv|mk|mg|ms|ml|mt|mi|mr|mh|mn|na|nv|nb|nd|ne|ng|nn|no|ii|nr|oc|oj|cu|om|or|os|pa|pi|fa|pl|ps|pt|qu|rm|rn|ro|ru|sa|sc|sd|se|sm|sg|sr|gd|sn|si|sk|sl|so|st|az|es|su|sw|ss|sv|ta|te|tg|th|ti|bo|tk|tl|tn|to|tr|ts|tt|tw|ty|ug|uk|ur|uz|ve|vi|vo|wa|cy|wo|fy|xh|yi|yo|za|zu)$/i

type LocaleType = CustomType<string, 'locale', {}>
export function locale(opts?: LocaleType['opts']) {
  return (
    m.custom({
      name: 'locale',
      decode: (input, opts, decodeOpts) => {
        const decoded = decode(m.string(), input, decodeOpts)
        if (!decoded.pass) {
          return decoded
        }
        if (!LOCALE_REGEX.test(decoded.value)) {
          return {
            pass: false,
            errors: [{ error: 'Invalid locale code [ISO 639-1]', value: input }],
          }
        }
        return decoded
      },
      encode: (input) => {
        return input
      },
      is(input) {
        return typeof input === 'string'
      },
    }),
    opts
  )
}
