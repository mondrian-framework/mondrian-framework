import {
  ArrayDecorator,
  DefaultDecorator,
  Infer,
  LazyType,
  NullableDecorator,
  OptionalDecorator,
  array,
  defaultType,
  named,
  nullable,
  optional,
} from './type-system'

export type DecoratorShorcuts<
  T extends LazyType,
  O extends 'optional' | 'nullable' | 'array' | 'named' | 'default' = never,
> = Omit<
  {
    optional(): OptionalDecorator<T> &
      DecoratorShorcuts<OptionalDecorator<T>, Exclude<O, 'named'> | 'default' | 'optional'>
    named(name: string): T & DecoratorShorcuts<T, O | 'named'>
    default(
      value: Infer<T> | (() => Infer<T>),
    ): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, O | 'default'>
    nullable(): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, Exclude<O, 'named'> | 'nullable'>
    array(
      opts?: ArrayDecorator['opts'],
    ): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>, Exclude<O, 'optional' | 'nullable' | 'named'>>
  },
  O
>

export function decoratorShorcuts<T extends LazyType>(t: T): DecoratorShorcuts<T> {
  return {
    array: (opts) => array(t, opts),
    optional: () => optional(t),
    nullable: () => nullable(t),
    default: (value) => defaultType(t, value),
    named: (name) => named(t, name),
  }
}
