# Production Token Security: JWT, Hashing, and Identifier Rotation

The patterns below are what a senior security engineer applies to keep tokens, hashes, and machine identifiers safe across a multi-region, multi-tenant production system. None of them are exotic — every one of them is a failure mode I have seen turn a routine deploy into a 48-hour incident.

## JWT validation is not signature verification

Most teams stop after verifying the signature. That is necessary but nowhere near sufficient. A correctly verified JWT can still be wrong in five different ways:

1. **Algorithm confusion.** A library that trusts the `alg` header lets an attacker switch from `RS256` to `HS256` and sign tokens with the public key. Always pin the expected algorithm; never accept what the token declares.
2. **Wrong audience.** A token issued by your auth service for `payments-api` should not be accepted by `notifications-api`. Verify `aud` exactly.
3. **Wrong issuer.** Accepting any signed token is a privilege-escalation primitive. Pin `iss` to the exact identity provider you trust.
4. **Expired token.** `exp` is mandatory to verify, but check `nbf` (not-before) and `iat` (issued-at with clock skew tolerance ≤ 60s) as well.
5. **Token replay.** For high-value operations, the JWT must carry a `jti` (JWT ID) which you record server-side; reject any reuse within the token's lifetime.

Use the [JWT Decoder](/tools/jwt-decoder) during incident response to inspect a token's claims locally. The browser-only workflow means a production token never leaves your laptop — critical when the token may be sensitive.

## Hashing: choose for the threat model, not for familiarity

`SHA-256` is fine for content addressing, deduplication, and integrity checks. It is **not** fine for password hashing — for that you need a memory-hard function (`argon2id`, `scrypt`, or `bcrypt` with cost ≥ 12).

For HMAC-based message authentication, prefer `HMAC-SHA-256` over raw hashes. Plain hashes are vulnerable to length-extension attacks; HMAC is not.

Use the [Hash Generator](/tools/hash-generator) to generate fingerprints for content verification — but if you find yourself wanting to hash a password with it, stop and switch to a password-specific library on your server.

### Algorithm agility

Every persisted hash should be self-describing: store `algorithm:cost:salt:hash` rather than just `hash`. This lets you migrate to a stronger algorithm without forcing a coordinated database rewrite. When (not if) SHA-256 is deprecated for some use case in 2030, your future self will thank you for the four extra bytes per row.

## Identifier rotation

For machine-to-machine tokens and API keys, set a **rotation policy** before you issue the first one. The policy needs three pieces:

1. **Maximum age.** Most teams pick 90 days; high-security teams pick 30.
2. **Grace overlap.** When you rotate, the old key remains valid for a documented window (24–72 hours) so consumers can switch without a downtime.
3. **Forced rotation triggers.** A confirmed leak, an employee departure with access to the key, or any unexplained anomaly in usage patterns triggers an immediate rotation outside the normal cadence.

Generate replacement identifiers with the [UUID Generator](/tools/uuid-generator). For machine credentials prefer UUIDv4 (random) or UUIDv7 (time-ordered, sortable, leak-safe).

## Constant-time comparison

This is one line of code that closes an entire attack class. Never use `===` or `strcmp` to compare a secret value against an expected value. Use `crypto.timingSafeEqual` (Node), `hmac.compare_digest` (Python), or your language's equivalent. The performance cost is microseconds; the security gain is enormous.

## Tooling and verification

Senior security engineers run every token-handling change through three checks before merging:

- **Static check:** confirm the token never appears in any log line (search for the `eyJ` JWT prefix in your log emitters).
- **Replay check:** confirm a captured token cannot be replayed against your service after revocation.
- **Constant-time check:** review every comparison touching a secret to confirm it uses a constant-time function.

When you run these checks during code review with the [JWT Decoder](/tools/jwt-decoder) open in another tab, the entire review takes five minutes and prevents months of incident response.

## Operational checklist

- [ ] Every JWT verifier pins `alg`, `iss`, `aud`, and validates `exp`, `nbf`, `iat`.
- [ ] High-value operations record `jti` server-side to prevent replay.
- [ ] Password hashing uses a memory-hard algorithm; content hashing uses SHA-256 minimum.
- [ ] All persisted hashes are self-describing with algorithm metadata.
- [ ] Machine credentials have a written rotation policy with maximum age, grace overlap, and forced-rotation triggers.
- [ ] Every secret comparison uses a constant-time function (reviewed manually for every PR touching auth code).
- [ ] Tokens never appear in logs, error messages, or analytics events.

The cost of these patterns is small; the cost of skipping them is measured in postmortems.
