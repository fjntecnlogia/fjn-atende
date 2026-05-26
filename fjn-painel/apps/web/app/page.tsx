"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
    } else if (user?.role === "super_admin") {
      router.replace("/admin");
    } else {
      router.replace("/dashboard");
    }
  }, [token, user, router]);

  // Fallback visual enquanto redireciona
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy2">
      <div className="text-center">
        <div className="font-display font-extrabold tracking-tight text-3xl mb-2">
          <span className="text-orange">FJN</span>
          <span className="text-light"> Atende</span>
        </div>
        <p className="text-sm text-gray2">Carregando...</p>
      </div>
    </div>
  );
}
