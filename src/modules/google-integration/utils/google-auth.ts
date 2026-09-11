import { GoogleAuth } from "google-auth-library"

// Creates an authenticated Google client using a store's saved
// service-account JSON credentials
export async function getGoogleAuthClient(credentials: Record<string, unknown> | string) {
  // Some DB drivers return JSON columns as a string instead of a parsed object
  const parsedCredentials =
    typeof credentials === "string" ? JSON.parse(credentials) : credentials

  const auth = new GoogleAuth({
    credentials: parsedCredentials as any,
    scopes: ["https://www.googleapis.com/auth/content"],
  })

  const client = await auth.getClient()
  return client
}