import { listReferences, saveReference } from "@/lib/admin/reference-api";
export async function GET() { return listReferences("supplier"); }
export async function POST(request: Request) { return saveReference("supplier", request); }
