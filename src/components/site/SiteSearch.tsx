import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchSite } from "@/lib/search-index";

/**
 * Site wide search. The index is bundled, so ranking runs locally on every
 * keystroke and tolerates typos such as "plumbr" or "recomendation".
 */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo(() => searchSite(query), [query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof results>();
    for (const result of results) {
      const list = map.get(result.page) ?? [];
      list.push(result);
      map.set(result.page, list);
    }
    return [...map.entries()];
  }, [results]);

  function go(to: string, hash?: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to, hash });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="min-h-11 min-w-11 sm:hidden"
        aria-label="Search VouchList"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>

      <Button
        variant="outline"
        className="hidden min-h-10 items-center gap-2 rounded-xl px-3 text-muted-foreground sm:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Search VouchList"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm">Search</span>
        <kbd className="ml-1 hidden rounded border border-border px-1.5 py-0.5 font-sans text-[10px] lg:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        label="Search VouchList"
      >
        <CommandInput
          placeholder="Search recommendations, features, privacy..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No matches. Try "plumber", "privacy" or "waitlist".</CommandEmpty>
          {groups.map(([page, items]) => (
            <CommandGroup key={page} heading={page}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => go(item.to, item.hash)}
                  className="flex flex-col items-start gap-1"
                >
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.summary}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
