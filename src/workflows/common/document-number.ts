/**
 * Sequential document numbers (PO-1001, TR-1001, ...).
 *
 * Derived from the highest number already issued rather than from a row count:
 * a count goes down when a record is deleted, which makes the next create reuse
 * a number that already exists and trips the unique index.
 *
 * The read and the insert still can't be atomic across two concurrent requests,
 * so callers wrap the insert in `withDocumentNumberRetry`, which regenerates
 * and tries again when the database rejects a duplicate.
 */

const START_AT = 1000

export function nextDocumentNumber(
  prefix: string,
  existingNumbers: string[]
): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)

  const highest = existingNumbers.reduce((max, value) => {
    const match = pattern.exec(value)
    return match ? Math.max(max, Number(match[1])) : max
  }, START_AT)

  return `${prefix}-${highest + 1}`
}

/** Postgres unique_violation, however the driver surfaces it. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  const message = String((error as { message?: string } | null)?.message ?? "")

  return (
    code === "23505" ||
    /duplicate key value|unique constraint|already exists/i.test(message)
  )
}

export async function withDocumentNumberRetry<T>(
  attempt: (documentNumber: string) => Promise<T>,
  generate: () => Promise<string>,
  maxAttempts = 5
): Promise<T> {
  let lastError: unknown

  for (let i = 0; i < maxAttempts; i++) {
    const documentNumber = await generate()

    try {
      return await attempt(documentNumber)
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error
      }

      lastError = error
    }
  }

  throw lastError
}
