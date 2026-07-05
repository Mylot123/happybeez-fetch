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
      <div className="h-[58px] rounded-xl bg-white/5 border border-white/5 animate-pulse" />
    );
  }

  const showSwitcher = memberships.length > 1;
  const initials = currentOrg.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/7 bg-ink-shell-soft hover:bg-white/10 transition-colors text-left",
          !showSwitcher && "cursor-default hover:bg-ink-shell-soft",
        )}
        disabled={!showSwitcher}
      >
        <div className="relative w-9 h-9 rounded-[10px] bg-signal text-white flex items-center justify-center flex-shrink-0 font-extrabold text-[12.5px]">
          {initials}
          <span className="absolute -bottom-0.5 -right-0.5 w-[9px] h-[9px] rounded-full bg-[#3DDC84] border-2 border-ink-shell-soft" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-white truncate leading-tight">
            {currentOrg.name}
          </p>
          <p className="text-[11px] text-white/50 truncate">
            {currentRole ? ROLE_LABEL[currentRole] : ""}
          </p>
        </div>
        {showSwitcher && <ChevronsUpDown className="w-3.5 h-3.5 text-white/40" />}
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
