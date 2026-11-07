
import { withUser } from "@/server/http"
import { exportUserData } from "@/server/services/privacy"

/** Downloads every piece of data stored for the user as a JSON file. */
export const GET = withUser(async ({ userId }) => {
  const data = await exportUserData(userId)
  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="clarifi-mis-datos-${date}.json"`,
      "cache-control": "no-store",
    },
  })
})
