import {
  ArrayDecorator,
  DefaultDecorator,
  Infer,
  LazyType,
  NullableDecorator,
  OptionalDecorator,
  array,
  defaultType,
  nullable,
  optional,
} from './type-system'

export type DecoratorShorcuts<
  T extends LazyType,
  O extends 'optional' | 'nullable' | 'array' | 'default' = never,
> = Omit<
  {
    optional(): OptionalDecorator<T> & DecoratorShorcuts<OptionalDecorator<T>, O | 'optional'>
    default(value: Infer<T>): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, O | 'default' | 'optional'>
    nullable(): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, O | 'nullable'>
    array(
      opts?: ArrayDecorator['opts'],
    ): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>, Exclude<O, 'optional' | 'nullable'>>
  },
  O
>

export function decoratorShorcuts<T extends LazyType>(t: T): DecoratorShorcuts<T> {
  return {
    array: (opts) => array(t, opts),
    optional: () => optional(t),
    nullable: () => nullable(t),
    default: (value) => defaultType(t, value),
  }
}
