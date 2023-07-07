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
    named(name: string): T & DecoratorShorcuts<T, O | 'named'>
    optional(
      opts?: OptionalDecorator['opts'],
    ): OptionalDecorator<T> & DecoratorShorcuts<OptionalDecorator<T>, Exclude<O, 'named'> | 'default' | 'optional'>
    default(
      value: Infer<T> | (() => Infer<T>),
      opts?: DefaultDecorator['opts'],
    ): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, O | 'default'>
    nullable(
      opts?: NullableDecorator['opts'],
    ): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, Exclude<O, 'named'> | 'nullable'>
    array(
      opts?: ArrayDecorator['opts'],
    ): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>, Exclude<O, 'optional' | 'nullable' | 'named'>>
  },
  O
>

export function decoratorShorcuts<T extends LazyType>(t: T): DecoratorShorcuts<T> {
  return {
    array: (opts) => array(t, opts),
    optional: (opts) => optional(t, opts),
    nullable: (opts) => nullable(t, opts),
    default: (value, opts) => defaultType(t, value, opts),
    named: (name) => named(t, name),
  }
}
