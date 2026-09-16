const STRIPE_API_URL = "https://api.stripe.com/v1";
const REQUEST_TIMEOUT_MS = 10_000;

type StripeMode = "test" | "live" | "unknown";

type StripeAccountResponse = {
  id?: string;
  object?: string;
  country?: string | null;
  default_currency?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  email?: string | null;
  business_profile?: {
    name?: string | null;
    url?: string | null;
  } | null;
  settings?: {
    dashboard?: {
      display_name?: string | null;
    } | null;
  } | null;
};

export type StripeConnectionStatus = {
  configured: boolean;
  connected: boolean;
  checkedAt: string;
  mode: StripeMode;
  publishableKeyConfigured: boolean;
  keysModeMatch: boolean;
  accountId: string | null;
  accountName: string | null;
  country: string | null;
  currency: string | null;
  email: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  message: string;
};

function getModeFromKey(value: string | undefined): StripeMode {
  if (!value) return "unknown";

  if (
    value.startsWith("sk_test_") ||
    value.startsWith("pk_test_") ||
    value.startsWith("rk_test_")
  ) {
    return "test";
  }

  if (
    value.startsWith("sk_live_") ||
    value.startsWith("pk_live_") ||
    value.startsWith("rk_live_")
  ) {
    return "live";
  }

  return "unknown";
}

function getCredentials() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  return {
    secretKey: secretKey || null,
    publishableKey: publishableKey || null,
    secretMode: getModeFromKey(secretKey),
    publishableMode: getModeFromKey(publishableKey),
  };
}

export function isStripeConfigured() {
  return Boolean(getCredentials().secretKey);
}

export async function testStripeConnection(): Promise<StripeConnectionStatus> {
  const checkedAt = new Date().toISOString();
  const credentials = getCredentials();

  const publishableKeyConfigured = Boolean(credentials.publishableKey);

  const keysModeMatch =
    !credentials.publishableKey ||
    credentials.secretMode === "unknown" ||
    credentials.publishableMode === "unknown" ||
    credentials.secretMode === credentials.publishableMode;

  if (!credentials.secretKey) {
    return {
      configured: false,
      connected: false,
      checkedAt,
      mode: "unknown",
      publishableKeyConfigured,
      keysModeMatch,
      accountId: null,
      accountName: null,
      country: null,
      currency: null,
      email: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      message: "Ajoutez STRIPE_SECRET_KEY dans le fichier .env.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${STRIPE_API_URL}/account`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.secretKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";

      try {
        const body = (await response.json()) as {
          error?: { message?: string };
        };

        detail = body.error?.message?.trim() || "";
      } catch {
        // Stripe peut renvoyer une réponse non JSON lors d'un incident externe.
      }

      const suffix = detail ? ` ${detail}` : "";

      throw new Error(
        response.status === 401 || response.status === 403
          ? `Clé Stripe refusée.${suffix}`
          : `Stripe a répondu avec le statut ${response.status}.${suffix}`,
      );
    }

    const account = (await response.json()) as StripeAccountResponse;

    const accountName =
      account.business_profile?.name?.trim() ||
      account.settings?.dashboard?.display_name?.trim() ||
      account.email?.trim() ||
      null;

    let message = "Connexion Stripe opérationnelle.";

    if (!keysModeMatch) {
      message =
        "Connexion réussie, mais les clés publique et secrète ne sont pas dans le même mode.";
    } else if (!publishableKeyConfigured) {
      message =
        "Connexion réussie. Ajoutez aussi la clé publique Stripe avant le checkout.";
    } else if (!account.details_submitted) {
      message =
        "Connexion réussie. La configuration du compte Stripe reste à finaliser.";
    }

    return {
      configured: true,
      connected: true,
      checkedAt,
      mode: credentials.secretMode,
      publishableKeyConfigured,
      keysModeMatch,
      accountId: account.id?.trim() || null,
      accountName,
      country: account.country?.toUpperCase() || null,
      currency: account.default_currency?.toUpperCase() || null,
      email: account.email?.trim() || null,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
      message,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Stripe n’a pas répondu dans le délai imparti."
        : error instanceof Error
          ? error.message
          : "Impossible de contacter Stripe.";

    return {
      configured: true,
      connected: false,
      checkedAt,
      mode: credentials.secretMode,
      publishableKeyConfigured,
      keysModeMatch,
      accountId: null,
      accountName: null,
      country: null,
      currency: null,
      email: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  payment_intent?: string | { id?: string } | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

function requireSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY est manquante.");
  }

  return key;
}

async function stripeRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${STRIPE_API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireSecretKey()}`,
        ...(init.headers || {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";

      try {
        const body = (await response.json()) as {
          error?: { message?: string };
        };

        detail = body.error?.message?.trim() || "";
      } catch {
        // Réponse Stripe non JSON éventuelle.
      }

      throw new Error(
        detail || `Stripe a répondu avec le statut ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createStripeCheckoutSession(input: {
  orderId: string;
  reference: string;
  customerId: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const body = new URLSearchParams();

  body.set("mode", "payment");
  body.set("payment_method_types[0]", "card");

  body.set("client_reference_id", input.orderId);
  body.set("customer_email", input.customerEmail);
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);

  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  body.set(
    "line_items[0][price_data][product_data][name]",
    `Commande OYSTE ${input.reference}`,
  );

  body.set("metadata[orderId]", input.orderId);
  body.set("metadata[customerId]", input.customerId);
  body.set("metadata[reference]", input.reference);

  body.set("payment_intent_data[metadata][orderId]", input.orderId);
  body.set("payment_intent_data[metadata][reference]", input.reference);

  return stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(
      sessionId,
    )}?expand[]=payment_intent`,
  );
}
