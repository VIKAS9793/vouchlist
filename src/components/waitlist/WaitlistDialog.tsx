import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WaitlistForm } from "./WaitlistForm";

export function WaitlistDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Bring VouchList to your community
          </DialogTitle>
          <DialogDescription>
            We onboard communities one at a time, with the group admin's consent. Tell us where you
            live and we'll take it from there.
          </DialogDescription>
        </DialogHeader>
        <WaitlistForm compact />
      </DialogContent>
    </Dialog>
  );
}
