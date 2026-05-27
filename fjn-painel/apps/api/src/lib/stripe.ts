import Stripe from "stripe";
import { config } from "../config";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY não configurado");
  }
  cached = new Stripe(config.STRIPE_SECRET_KEY, {
    apiVersion: "2024-12-18.acacia" as any,
    typescript: true,
  });
  return cached;
}

export function isStripeEnabled(): boolean {
  return !!config.STRIPE_SECRET_KEY;
}
