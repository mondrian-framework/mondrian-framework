import { model, validation } from '@mondrian-framework/model'

export function addValidationLogic<K extends string, T extends model.Type>(
  typeName: K,
  type: T,
  validator: (value: model.Infer<T>) => validation.Result,
): model.CustomType<K, {}, model.Infer<T>> {
  return model.custom<K, {}, any>({
    typeName,
    decoder(value, decodingOptions) {
      return model.concretise(type).decodeWithoutValidation(value, decodingOptions)
    },
    arbitrary(maxDepth) {
      return model.concretise(type).arbitrary(maxDepth)
    },
    encoder(value, encodingOptions) {
      return model.concretise(type).encodeWithoutValidation(value as never, encodingOptions) as any
    },
    validator(value, validationOptions) {
      const validation = model.concretise(type).validate(value as never, validationOptions)
      return validation.chain(() => validator(value as never))
    },
    options: { apiType: type },
  })
}
