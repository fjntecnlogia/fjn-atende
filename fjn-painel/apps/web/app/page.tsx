"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { token } = useAuth();
  useEffect(() => {
    router.replace(token ? "/dashboard" : "/login");
  }, [token, router]);
  return null;
}
