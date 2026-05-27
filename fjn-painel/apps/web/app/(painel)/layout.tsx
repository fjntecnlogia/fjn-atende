"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SubscriptionBanner } from "@/components/layout/SubscriptionBanner";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAuth();
  const { connected } = useRealtime();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    } else {
      localStorage.setItem("fjn_token", token);
    }
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar realtimeConnected={connected} />
      <main className="flex-1 overflow-x-hidden flex flex-col">
        <SubscriptionBanner />
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
