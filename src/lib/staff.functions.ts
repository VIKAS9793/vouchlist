import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Is the signed-in person internal staff?
 *
 * The decision is made on the server from the verified session claims, never
 * from anything the browser sends. The client only ever learns a boolean.
 */
export const getStaffAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isStaff: boolean }> => {
    const { isOwnerEmail } = await import("./staff.server");
    const email = (context.claims as { email?: unknown }).email;
    return { isStaff: isOwnerEmail(email) };
  });
