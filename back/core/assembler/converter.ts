export type Converter<T, U> = (from: T) => U;
export type AsyncConverter<T, U> = (from: T) => Promise<U>
