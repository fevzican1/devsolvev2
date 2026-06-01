# Safely Decoding Tokens in the Browser (No Verification)

JSON Web Tokens (JWTs) are widely used for authentication and authorization in modern web applications. Understanding how to inspect these tokens helps developers debug authentication issues and understand what data is being transmitted.

## What is a JWT?

A JWT consists of three parts separated by dots:
- **Header**: Contains the token type and signing algorithm
- **Payload**: Contains the claims (user data, expiration, etc.)
- **Signature**: Used to verify the token hasn't been tampered with

Each part is Base64URL encoded, making it possible to decode the header and payload without the secret key.

## Why Decode Without Verification?

There are legitimate reasons to decode a JWT without verifying its signature:

- **Debugging**: Inspect token contents during development
- **Understanding structure**: Learn what claims your application receives
- **Troubleshooting**: Identify expired tokens or missing claims
- **Client-side display**: Show user information stored in the token

However, decoded data should never be trusted for security decisions without proper server-side verification.

## The Structure of JWT Claims

Common claims you'll find in JWT payloads include:

### Registered Claims
- `iss` (issuer): Who created the token
- `sub` (subject): The user or entity the token represents
- `aud` (audience): Intended recipient of the token
- `exp` (expiration): When the token expires (Unix timestamp)
- `iat` (issued at): When the token was created
- `nbf` (not before): Token is not valid before this time

### Custom Claims
Applications often add custom claims for user roles, permissions, or other application-specific data.

## Using the JWT Decoder Tool

Our [JWT Decoder tool](/tools/jwt-decoder) processes tokens entirely in your browser. This is particularly important for JWTs, which often contain sensitive user information.

The tool:
- Separates and decodes all three token parts
- Formats the JSON for readability
- Displays expiration times in human-readable format
- Clearly indicates this is decode-only, not verification

## Security Considerations

Decoding a JWT reveals its contents, but this alone doesn't compromise security because:

1. The signature cannot be forged without the secret key
2. Servers should always verify tokens before trusting them
3. Sensitive data shouldn't be stored in JWTs anyway

However, be cautious about where you decode tokens. Using browser-based local tools ensures your tokens aren't transmitted to third-party servers.
