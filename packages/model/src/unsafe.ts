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
} from './type-system'

/**
 * Type unsafe class for making a lazy type seems like a type.
 * It's used on operator that is not supported first-class as example 'merge' and 'select'
 */
export class LazyTypeWrapper<T extends Type> implements Type, DecoratorShorcuts<T> {
  public get kind(): any {
    return this.getType().kind
  }
  public get opts(): any {
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
  private cachedType: T | null
  private getter: () => T
  constructor(getter: () => T) {
    this.getter = getter
    this.cachedType = null
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

  private getType(): any {
    if (this.cachedType === null) {
      this.cachedType = this.getter()
    }
    return this.cachedType
  }
}
