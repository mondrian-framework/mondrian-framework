import {
  ArrayDecorator,
  DefaultDecorator,
  LazyType,
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
    optional(): { kind: 'optional-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'optional-decorator'; type: T },
      O | 'optional'
    >
    default(
      value: any, //[LazyToType<T>] extends [{ kind: Type['kind'] }] ? Infer<T> : any,
    ): { kind: 'default-decorator'; type: T; opts: DefaultDecorator['opts'] } & DecoratorShorcuts<
      { kind: 'default-decorator'; type: T; opts: DefaultDecorator['opts'] },
      O | 'default' | 'optional'
    >
    nullable(): { kind: 'nullable-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'nullable-decorator'; type: T },
      O | 'nullable'
    >
    array(
      opts?: ArrayDecorator['opts'],
    ): { kind: 'array-decorator'; type: T } & DecoratorShorcuts<
      { kind: 'array-decorator'; type: T },
      Exclude<O, 'optional' | 'nullable'>
    >
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
