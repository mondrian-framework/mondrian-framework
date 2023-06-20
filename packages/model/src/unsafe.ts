import { DecoratorShorcuts } from './decorator-shortcut'
import {
  OptionalDecorator,
  Type,
  optional,
  nullable,
  defaultType,
  array,
  Infer,
  DefaultDecorator,
  NullableDecorator,
  ArrayDecorator,
  named,
  LazyType,
  AnyType,
} from './type-system'
import { lazyToType } from './utils'

/**
 * Type unsafe class for making a lazy type seems like a type.
 * It's used on operator that is not supported first-class as example 'merge' and 'select'
 */
export class LazyTypeWrapper<T extends LazyType> implements Type, DecoratorShorcuts<T> {
  public get kind(): any {
    return this.getType().kind
  }
  public get opts(): any {
    if (this.optsOverrides) {
      return { ...this.getType().opts, ...this.optsOverrides }
    }
    return this.getType().opts
  }
  public get values(): any {
    return this.getType().values
  }
  public get type(): any {
    return this.getType().type
  }
  public get types(): any {
    return this.getType().values
  }
  private cachedType: AnyType | null
  private getter: T
  private optsOverrides?: Record<string, unknown>
  constructor(getter: T, opts?: Record<string, unknown>) {
    this.getter = getter
    this.cachedType = null
    this.optsOverrides = opts
  }

  public optional(): OptionalDecorator<T> & DecoratorShorcuts<OptionalDecorator<T>, 'optional' | 'default'> {
    return optional(this) as any
  }
  public default(
    value: Infer<T> | (() => Infer<T>),
  ): DefaultDecorator<T> & DecoratorShorcuts<DefaultDecorator<T>, 'default'> {
    return defaultType(this, value as any) as any
  }
  public nullable(): NullableDecorator<T> & DecoratorShorcuts<NullableDecorator<T>, 'nullable'> {
    return nullable(this) as any
  }
  public array(
    opts?: { maxItems?: number | undefined } | undefined,
  ): ArrayDecorator<T> & DecoratorShorcuts<ArrayDecorator<T>, never> {
    return array(this, opts) as any
  }
  public named(name: string): T & DecoratorShorcuts<T, 'named'> {
    return named(this, name) as any
  }

  private getType(): any {
    if (this.cachedType === null) {
      this.cachedType = lazyToType(this.getter)
    }
    return this.cachedType
  }
}
