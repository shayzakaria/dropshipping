import { createHash } from "node:crypto";

/**
 * Buyer identity, kept as a fingerprint instead of a value.
 *
 * The platform never needs to *read* who a buyer is. It only ever asks two
 * yes/no questions: "is this the influencer's own address?" and "has this
 * person bought from this business before?". Both are equality checks, and an
 * equality check works just as well on a hash — so we store the hash and never
 * hold a third party's email address at all.
 *
 * The pepper is a secret, not a salt: a bare SHA-256 of an email is trivially
 * reversed by hashing a list of addresses. With a secret pepper, someone who
 * walks off with the redemptions table walks off with nothing.
 */
const DEV_PEPPER = "boost-dev-pepper-not-a-secret";

let warned = false;

function pepper(): string {
  const fromEnv = process.env.CUSTOMER_REF_PEPPER;
  if (fromEnv) return fromEnv;
  if (!warned && process.env.NODE_ENV === "production") {
    warned = true;
    console.warn(
      "[BOOST] CUSTOMER_REF_PEPPER is not set — buyer fingerprints are using the public development pepper.",
    );
  }
  return DEV_PEPPER;
}

/** Normalize the way a buyer identifier is written before it is fingerprinted. */
export function normalizeCustomerRef(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Fingerprint a buyer identifier (email or phone). Returns undefined for an
 * empty input so callers can keep treating "no identifier" as absent.
 *
 * Changing the pepper invalidates every fingerprint already stored: the
 * new-customer check would start seeing returning buyers as new. Treat it as
 * permanent once real redemptions exist.
 */
export function hashCustomerRef(raw: string | undefined): string | undefined {
  const value = raw ? normalizeCustomerRef(raw) : "";
  if (!value) return undefined;
  return createHash("sha256").update(`${pepper()}\n${value}`).digest("hex");
}
