import { createThirdwebClient } from "thirdweb";

// Server-side client — THIRDWEB_SECRET_KEY never exposed to browser
export function getThirdwebServerClient() {
  return createThirdwebClient({
    secretKey: process.env.THIRDWEB_SECRET_KEY!,
  });
}

// Client-side client — uses publishable client ID only
export function getThirdwebClientId() {
  return process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!;
}
