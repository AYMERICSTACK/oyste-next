/* eslint-disable @typescript-eslint/no-explicit-any */
const SENDCLOUD_API_URL = "https://panel.sendcloud.sc/api/v2";
const REQUEST_TIMEOUT_MS = 12_000;

type SendcloudShippingMethod = {
  id?: number;
  name?: string;
  carrier?: string;
  min_weight?: string;
  max_weight?: string;
};

type SendcloudShippingMethodsResponse = {
  shipping_methods?: SendcloudShippingMethod[];
};

export type SendcloudConnectionStatus = {
  configured: boolean;
  connected: boolean;
  checkedAt: string;
  methodsCount: number;
  carriers: string[];
  sampleMethods: Array<{ id: number | null; name: string; carrier: string | null }>;
  message: string;
};

function getCredentials() {
  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY?.trim();
  const secretKey = process.env.SENDCLOUD_SECRET_KEY?.trim();

  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey };
}

export function isSendcloudConfigured() {
  return Boolean(getCredentials());
}

export async function testSendcloudConnection(): Promise<SendcloudConnectionStatus> {
  const checkedAt = new Date().toISOString();
  const credentials = getCredentials();

  if (!credentials) {
    return {
      configured: false,
      connected: false,
      checkedAt,
      methodsCount: 0,
      carriers: [],
      sampleMethods: [],
      message: "Ajoutez SENDCLOUD_PUBLIC_KEY et SENDCLOUD_SECRET_KEY dans le fichier .env.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const authorization = Buffer.from(`${credentials.publicKey}:${credentials.secretKey}`).toString("base64");
    const response = await fetch(`${SENDCLOUD_API_URL}/shipping_methods`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authorization}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as { error?: { message?: string }; message?: string };
        detail = body.error?.message ?? body.message ?? "";
      } catch {
        // Sendcloud peut renvoyer une réponse non JSON en cas d'incident externe.
      }

      const suffix = detail ? ` ${detail}` : "";
      throw new Error(
        response.status === 401 || response.status === 403
          ? `Clés Sendcloud refusées.${suffix}`
          : `Sendcloud a répondu avec le statut ${response.status}.${suffix}`,
      );
    }

    const payload = (await response.json()) as SendcloudShippingMethodsResponse;
    const methods = Array.isArray(payload.shipping_methods) ? payload.shipping_methods : [];
    const carriers = Array.from(
      new Set(methods.map((method) => method.carrier?.trim()).filter((carrier): carrier is string => Boolean(carrier))),
    ).sort((a, b) => a.localeCompare(b, "fr"));

    return {
      configured: true,
      connected: true,
      checkedAt,
      methodsCount: methods.length,
      carriers,
      sampleMethods: methods.filter((method) => !/unstamped|letter/i.test(method.name || "")).slice(0, 6).map((method) => ({
        id: typeof method.id === "number" ? method.id : null,
        name: method.name?.trim() || "Méthode sans nom",
        carrier: method.carrier?.trim() || null,
      })),
      message:
        methods.length > 0
          ? "Connexion Sendcloud opérationnelle."
          : "Connexion réussie, mais aucune méthode d’expédition n’est encore disponible pour ce compte.",
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Sendcloud n’a pas répondu dans le délai imparti."
        : error instanceof Error
          ? error.message
          : "Impossible de contacter Sendcloud.";

    return {
      configured: true,
      connected: false,
      checkedAt,
      methodsCount: 0,
      carriers: [],
      sampleMethods: [],
      message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

const SENDCLOUD_API_V3_URL = "https://panel.sendcloud.sc/api/v3";

export type SendcloudShippingOption = {
  code: string;
  name: string;
  carrierCode: string;
  carrierName: string;
  contractId: number | null;
  price: number | null;
  currency: string | null;
  leadTimeHours: number | null;
};

type ParcelInput = {
  orderReference: string;
  totalTtc: number;
  recipient: {
    name: string;
    company: string;
    address1: string;
    address2?: string | null;
    postalCode: string;
    city: string;
    country: string;
    phone: string;
    email: string;
  };
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  option: SendcloudShippingOption;
};

function authorizationHeader() {
  const credentials = getCredentials();
  if (!credentials) throw new Error("Les clés Sendcloud ne sont pas configurées.");
  return `Basic ${Buffer.from(`${credentials.publicKey}:${credentials.secretKey}`).toString("base64")}`;
}

async function sendcloudFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SENDCLOUD_API_V3_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: authorizationHeader(),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        const payload = (await response.json()) as { errors?: Array<{ detail?: string }>; message?: string };
        detail = payload.errors?.map((error) => error.detail).filter(Boolean).join(" ") || payload.message || "";
      } catch {}
      throw new Error(detail || `Sendcloud a répondu avec le statut ${response.status}.`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSendcloudSenderAddress() {
  const response = await sendcloudFetch("/addresses/sender-addresses");
  const payload = (await response.json()) as { data?: Array<{ id?: number; country_code?: string; postal_code?: string }> };
  const sender = payload.data?.[0];
  if (!sender?.id) throw new Error("Aucune adresse expéditeur n’est configurée dans Sendcloud.");
  return { id: sender.id, countryCode: sender.country_code || "FR", postalCode: sender.postal_code || "" };
}

export async function getSendcloudShippingOptions(input: { weightKg: number; lengthCm?: number; widthCm?: number; heightCm?: number; toCountry: string; toPostalCode: string }) {
  const sender = await getSendcloudSenderAddress();
  const hasDimensions =
    typeof input.lengthCm === "number" && input.lengthCm > 0 &&
    typeof input.widthCm === "number" && input.widthCm > 0 &&
    typeof input.heightCm === "number" && input.heightCm > 0;

  const response = await sendcloudFetch("/fetch-shipping-options", {
    method: "POST",
    body: JSON.stringify({
      from_country_code: sender.countryCode,
      to_country_code: input.toCountry,
      from_postal_code: sender.postalCode || undefined,
      to_postal_code: input.toPostalCode,
      weight: { value: String(input.weightKg), unit: "kg" },
      ...(hasDimensions
        ? { dimensions: { length: String(input.lengthCm), width: String(input.widthCm), height: String(input.heightCm), unit: "cm" } }
        : {}),
    }),
  });
  const payload = (await response.json()) as { data?: Array<any> };
  return (payload.data || [])
    .filter((option) => option?.code && option?.carrier?.code && !String(option.code).includes("letter"))
    .map((option): SendcloudShippingOption => ({
      code: String(option.code),
      name: String(option.name || option.product?.name || option.code),
      carrierCode: String(option.carrier.code),
      carrierName: String(option.carrier.name || option.carrier.code),
      contractId: typeof option.contract?.id === "number" ? option.contract.id : null,
      price: option.quotes?.[0]?.price?.total?.value != null ? Number(option.quotes[0].price.total.value) : null,
      currency: option.quotes?.[0]?.price?.total?.currency || null,
      leadTimeHours: typeof option.quotes?.[0]?.lead_time === "number" ? option.quotes[0].lead_time : null,
    }))
    .sort((a, b) => (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 30);
}

export async function createSendcloudShipment(input: ParcelInput) {
  const sender = await getSendcloudSenderAddress();
  const properties: Record<string, string | number> = { shipping_option_code: input.option.code };
  if (input.option.contractId) properties.contract_id = input.option.contractId;
  const response = await sendcloudFetch("/shipments/announce", {
    method: "POST",
    body: JSON.stringify({
      label_details: { mime_type: "application/pdf", dpi: 72 },
      from_address: { sender_address_id: sender.id },
      to_address: {
        name: input.recipient.name,
        company_name: input.recipient.company || undefined,
        address_line_1: input.recipient.address1,
        address_line_2: input.recipient.address2 || undefined,
        postal_code: input.recipient.postalCode,
        city: input.recipient.city,
        country_code: input.recipient.country,
        phone_number: input.recipient.phone,
        email: input.recipient.email,
      },
      ship_with: { type: "shipping_option_code", properties },
      order_number: input.orderReference,
      reference: input.orderReference,
      external_reference_id: `oyste-${input.orderReference}`,
      total_order_price: { value: input.totalTtc.toFixed(2), currency: "EUR" },
      parcels: [{
        dimensions: { length: String(input.lengthCm), width: String(input.widthCm), height: String(input.heightCm), unit: "cm" },
        weight: { value: String(input.weightKg), unit: "kg" },
      }],
    }),
  });
  const payload = (await response.json()) as { data?: any };
  const shipment = payload.data;
  const parcel = shipment?.parcels?.[0];
  if (!shipment?.id || !parcel?.id) throw new Error("Sendcloud n’a pas renvoyé les informations de l’expédition.");
  const labelUrl = parcel.documents?.find((document: any) => document.type === "label")?.link || null;
  return {
    externalShipmentId: String(shipment.id),
    parcelId: String(parcel.id),
    status: String(parcel.status?.code || "READY_TO_SEND"),
    trackingNumber: parcel.tracking_number ? String(parcel.tracking_number) : null,
    trackingUrl: parcel.tracking_url ? String(parcel.tracking_url) : null,
    labelUrl,
  };
}

export async function downloadSendcloudDocument(url: string) {
  if (!url.startsWith(`${SENDCLOUD_API_V3_URL}/`)) throw new Error("URL de document Sendcloud invalide.");
  return sendcloudFetch(url.slice(SENDCLOUD_API_V3_URL.length), { headers: { Accept: "application/pdf" } });
}
