import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useSession } from "@/lib/auth";

/**
 * Sign-in affordance in the header.
 *
 * VouchList is a pre-launch product site: there is nothing for a customer to
 * sign in to, so signed-out visitors see no sign-in control at all. The people
 * who run VouchList reach /auth directly. Once signed in, the header shows the
 * account menu, so a successful sign-in visibly changes the header.
 */
export function AuthMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { loading, user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Nothing at all for visitors: no control, and no reserved gap in the header.
  if (loading || !user) return null;

  async function onSignOut() {
    onNavigate?.();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="min-h-10 gap-2 rounded-xl">
          <UserIcon aria-hidden="true" className="size-4" />
          <span className="hidden max-w-32 truncate sm:inline">{displayName(user)}</span>
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" onClick={onNavigate}>
            Your account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onSignOut()}>
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
