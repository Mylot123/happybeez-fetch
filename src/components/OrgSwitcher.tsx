import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useState } from "react";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABEL: Record<string, string> = {
  agency_admin: "Bureau-admin",
  org_admin: "Org-admin",
  editor: "Editor",
};

export function OrgSwitcher() {
  const { memberships, currentOrg, currentRole, setCurrentOrgId, isLoading } = useCurrentOrg();
  const [open, setOpen] = useState(false);

  if (isLoading || !currentOrg) {
    return (
      <div className="h-9 rounded-md border border-border/60 bg-muted/40 animate-pulse" />
    );
  }

  const showSwitcher = memberships.length > 1;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "w-full flex items-center gap-2 px-2.5 py-2 rounded-md border border-border/60 bg-background hover:bg-muted transition-colors text-left",
          !showSwitcher && "cursor-default hover:bg-background",
        )}
        disabled={!showSwitcher}
      >
        <div className="w-7 h-7 rounded bg-wine/10 text-wine flex items-center justify-center flex-shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink truncate">{currentOrg.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentRole ? ROLE_LABEL[currentRole] : ""}
          </p>
        </div>
        {showSwitcher && <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </DropdownMenuTrigger>
      {showSwitcher && (
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Wissel organisatie</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {memberships.map((m) => (
            <DropdownMenuItem
              key={m.org_id}
              onClick={() => setCurrentOrgId(m.org_id)}
              className="flex items-center gap-2"
            >
              <span className="flex-1 truncate">{m.organization.name}</span>
              {m.org_id === currentOrg.id && <Check className="w-3.5 h-3.5 text-wine" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
