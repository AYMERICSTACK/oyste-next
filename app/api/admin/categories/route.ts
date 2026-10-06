import { listReferences, saveReference } from "@/lib/admin/reference-api";
export async function GET() { return listReferences("category"); }
export async function POST(request: Request) { return saveReference("category", request); }
