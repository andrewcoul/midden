import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ItemActionsProvider } from "@/components/item-actions";
import { SignIn } from "@/components/sign-in";
import { UploadsProvider } from "@/hooks/use-uploads";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app")({ component: AppLayout });

function AppLayout() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me, staleTime: Infinity });

  useEffect(() => {
    const onLoggedOut = () => qc.invalidateQueries({ queryKey: ["me"] });
    window.addEventListener("midden:logged-out", onLoggedOut);
    return () => window.removeEventListener("midden:logged-out", onLoggedOut);
  }, [qc]);

  if (me.isPending) return <div className="satin min-h-dvh" />;
  if (me.isError) return <SignIn me={null} />;
  if (!me.data.authenticated) return <SignIn me={me.data} />;
  return (
    <UploadsProvider>
      <ItemActionsProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </ItemActionsProvider>
    </UploadsProvider>
  );
}
