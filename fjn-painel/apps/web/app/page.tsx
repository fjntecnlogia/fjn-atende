"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export default function HomePage() {
  const router = useRouter();
  const { token, user } = useAuth();

  // Se está logado, redireciona direto pro painel
  useEffect(() => {
    if (token) {
      if (user?.role === "super_admin") router.replace("/admin");
      else router.replace("/dashboard");
    }
  }, [token, user, router]);

  // Se não está logado, mostra landing
  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy2">
        <div className="text-center">
          <div className="font-display font-extrabold tracking-tight text-3xl mb-2">
            <span className="text-orange">FJN</span>
            <span className="text-light"> Atende</span>
          </div>
          <p className="text-sm text-gray2">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}
