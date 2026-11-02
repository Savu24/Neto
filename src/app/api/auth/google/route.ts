import { NextResponse } from "next/server";
import { googleClient, startGoogleLogin } from "@/lib/auth/google";

export async function GET(request: Request) {
  const client = googleClient();
  if (!client) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.redirect(await startGoogleLogin(client));
}
