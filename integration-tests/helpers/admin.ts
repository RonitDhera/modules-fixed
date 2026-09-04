/**
 * Creates (once) and logs in an admin user over HTTP, and returns the request
 * config every admin call needs.
 *
 * Done through the public auth routes rather than by signing a JWT by hand, so
 * the tests do not depend on the framework's internal token format.
 */

export type RequestConfig = { headers: Record<string, string> }

const ADMIN_EMAIL = "admin@medusa-test.com"
const ADMIN_PASSWORD = "test-only-password"

type ApiClient = {
  post: (
    path: string,
    body?: unknown,
    config?: RequestConfig
  ) => Promise<{ data: Record<string, string> }>
}

export async function getAdminHeaders(
  api: ApiClient,
  container?: any
): Promise<RequestConfig> {
  // Try to register + login normally first
  try {
    await api.post("/auth/user/emailpass/register", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    })
  } catch {
    // already registered, fine
  }

  // If we have access to the container, ensure a user is linked to the auth identity
  if (container) {
    try {
      const userModuleService = container.resolve("user")
      const authModuleService = container.resolve("auth")

      const [existingUser] = await userModuleService.listUsers({
        email: ADMIN_EMAIL,
      })

      if (!existingUser) {
        const [authIdentity] = await authModuleService.listAuthIdentities({
          entity_id: ADMIN_EMAIL,
        })

        const newUser = await userModuleService.createUsers({
          email: ADMIN_EMAIL,
          first_name: "Test",
          last_name: "Admin",
        })

        if (authIdentity) {
          await authModuleService.updateAuthIdentities({
            id: authIdentity.id,
            app_metadata: { user_id: newUser.id },
          })
        }
      }
    } catch (err: any) {
      console.log("DIRECT USER LINK FAILED:", err?.message || err)
    }
  }

  const login = await api.post("/auth/user/emailpass", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })

  return { headers: { authorization: `Bearer ${login.data.token}` } }
}