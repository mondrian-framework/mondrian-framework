export type Test<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? Pass
    : { actual: T; expected: U }
  : { actual: T; expected: U }
type Pass = 'pass'

export function typeAssert<T1, T2, T = Test<T1, T2>>(param: T extends Pass ? {} : T): void {}
