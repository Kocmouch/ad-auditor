declare module "bun:test" {
  export function describe(name: string, fn: () => void): void
  export function test(name: string, fn: () => void | Promise<void>): void
  export function beforeEach(fn: () => void | Promise<void>): void
  export function afterEach(fn: () => void | Promise<void>): void
  interface Matchers<T> {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toHaveLength(expected: number): void
    toBeNull(): void
    toBeCloseTo(expected: number, digits?: number): void
    toBeLessThan(expected: number): void
    toBeGreaterThan(expected: number): void
    toContain(expected: unknown): void
    not: Matchers<T>
  }
  export const expect: <T>(actual: T) => Matchers<T>
}
