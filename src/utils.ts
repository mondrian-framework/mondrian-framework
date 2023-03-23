export type PartialDeep<T> = T extends Date
  ? Date | undefined
  : T extends object
  ? {
      [K in keyof T]?: PartialDeep<T[K]>
    }
  : T
