# Security Features

This document outlines the comprehensive security features implemented in the n8n SAP OData community node.

## Table of Contents

- [Overview](#overview)
- [Input Validation](#input-validation)
- [SSRF Protection](#ssrf-protection)
- [Injection Prevention](#injection-prevention)
- [Rate Limiting](#rate-limiting)
- [Data Sanitization](#data-sanitization)
- [Security Best Practices](#security-best-practices)

---

## Overview

The SAP OData node implements defense-in-depth security measures to protect against common attacks including:

- **SSRF (Server-Side Request Forgery)** - Prevents access to internal resources
- **SQL Injection** - Validates entity keys and filters
- **XSS (Cross-Site Scripting)** - Filters dangerous patterns in OData filters
- **Prototype Pollution** - Blocks dangerous JavaScript object keys
- **Header Injection** - Sanitizes all header values
- **DoS (Denial of Service)** - Limits input sizes and request rates

All security validations are:
- ✅ Automatically applied to all requests
- ✅ Covered by comprehensive unit tests (61 security tests)
- ✅ Integrated at multiple layers (input, processing, output)

---

## Input Validation

### JSON Input Validation

**Function**: `validateJsonInput()`

Protects against JSON-based attacks:

```typescript
// Validates:
// - Maximum size: 10MB
// - Maximum nesting depth: 100 levels
// - Blocks prototype pollution (__proto__, constructor, prototype)
// - Recursive validation of nested objects

validateJsonInput(jsonString, 'fieldName', node);
```

**Protection against**:
- **Prototype Pollution**: Blocks `__proto__`, `constructor`, `prototype` keys
- **DoS**: Limits JSON size to 10MB and nesting to 100 levels
- **Invalid JSON**: Provides clear error messages

**Example blocked payloads**:
```json
// Prototype pollution attempt
{"__proto__": {"isAdmin": true}}

// Deeply nested DoS attack
{"a": {"b": {"c": ... }}} // 101+ levels deep

// Oversized payload
{"data": "x".repeat(11MB)}
```

### Entity Set & Function Name Validation

**Functions**: `validateEntitySetName()`, `validateFunctionName()`

Ensures only valid identifiers are used:

```typescript
// Only allows: a-z, A-Z, 0-9, _
// Max length: 255 characters
// Prevents: SQL injection, path traversal, special characters

validateEntitySetName('ProductSet', node);  // ✅ Valid
validateEntitySetName('Product-Set', node); // ❌ Rejected
```

**Example rejected inputs**:
```
Product-Set    // Contains hyphen
Product Set    // Contains space
Product/Set    // Path traversal attempt
Product;DROP   // SQL injection attempt
```

### Entity Key Validation

**Function**: `validateEntityKey()`

Protects against SQL injection in entity keys:

```typescript
// Blocks SQL commands: DROP, DELETE, INSERT, UPDATE, EXEC
// Blocks comment markers: --, /*, */
// Validates composite key format

validateEntityKey("'12345'", node);                    // ✅ Simple key
validateEntityKey("Key1='val1',Key2='val2'", node);    // ✅ Composite key
validateEntityKey("'; DROP TABLE --", node);           // ❌ Rejected
```

**Composite key format**:
```
Key1='value1',Key2='value2',Key3='value3'
```

### OData Filter Validation

**Function**: `validateODataFilter()`

Prevents XSS and injection attacks in filters:

```typescript
// Blocks:
// - javascript: protocol
// - <script> tags
// - Event handlers (onclick=, onerror=, etc.)
// - eval() expressions
// - CSS expression() attacks

validateODataFilter("Name eq 'Product'", node);     // ✅ Valid
validateODataFilter("<script>alert(1)</script>", node); // ❌ Rejected
```

**Example blocked patterns**:
```
javascript:alert(1)
<script>alert(1)</script>
onclick=alert(1)
eval(...)
expression(...)
```

---

## SSRF Protection

### URL Validation

**Function**: `validateUrl()`

Comprehensive SSRF protection blocks access to:

#### 1. Invalid Protocols
```typescript
// Only HTTP and HTTPS allowed
validateUrl('https://example.com', node); // ✅ Valid
validateUrl('ftp://example.com', node);   // ❌ Rejected
validateUrl('file:///etc/passwd', node);  // ❌ Rejected
```

#### 2. Localhost Access
```typescript
// Blocks all localhost variants
http://localhost
http://127.0.0.1
http://127.1
http://[::1]
http://0.0.0.0
```

#### 3. Private IP Ranges
```typescript
// Blocks RFC 1918 private networks
http://10.0.0.1           // Class A private
http://172.16.0.1         // Class B private
http://192.168.1.1        // Class C private
http://169.254.169.254    // Link-local
```

#### 4. IPv6 Private Ranges
```typescript
http://[fc00::1]  // IPv6 private
http://[fe80::1]  // IPv6 link-local
```

#### 5. Cloud Metadata Endpoints
```typescript
// Prevents cloud provider credential theft
http://169.254.169.254/latest/meta-data  // AWS, Azure, GCP
http://metadata.google.internal           // Google Cloud
http://metadata.azure.com                 // Azure
```

**Implementation**:
```typescript
// Automatically called in GenericFunctions
validateUrl(credentials.host, this.getNode());
```

---

## Injection Prevention

### Header Injection Protection

**Function**: `sanitizeHeaderValue()`

Prevents HTTP header injection attacks:

```typescript
// Removes CR/LF characters that could split headers
sanitizeHeaderValue('value\r\nInjected-Header: malicious');
// Returns: 'valueInjected-Header: malicious'
```

**Applied to**:
- CSRF tokens
- Custom headers
- All user-provided header values

### SQL Injection Prevention

Implemented in multiple layers:

1. **Entity Key Validation** - Blocks SQL commands and comment markers
2. **Entity Set Names** - Only alphanumeric and underscore allowed
3. **Function Names** - Only alphanumeric and underscore allowed

### Path Traversal Prevention

**Function**: `buildSecureUrl()`

Sanitizes URL paths:

```typescript
// Removes ../ and ..\ patterns
buildSecureUrl('https://example.com', '/service/../admin/', '/data');
// Removes path traversal attempts
```

---

## Rate Limiting

**Class**: `RateLimiter`

Prevents abuse and DoS attacks:

```typescript
// 100 requests per minute per identifier
const limiter = new RateLimiter(60000, 100);

if (!limiter.isAllowed(userId)) {
  throw new Error('Rate limit exceeded');
}

// Check remaining quota
const remaining = limiter.getRemaining(userId);
```

**Features**:
- Sliding window algorithm
- Per-identifier tracking
- Automatic cleanup of old entries
- Configurable window and limits

**Default configuration**:
- Window: 60 seconds
- Max requests: 100 per window

---

## Data Sanitization

### Error Message Sanitization

**Function**: `sanitizeErrorMessage()`

Removes sensitive information from error messages:

```typescript
// Masks:
// - Passwords in URLs
// - Bearer tokens
// - API keys
// - Basic auth credentials

sanitizeErrorMessage('Error: https://user:password@server.com');
// Returns: 'Error: https://***:***@server.com'
```

**Patterns masked**:
```
password=***
pwd=***
token=***
api_key=***
Authorization: Bearer ***
://***:***@  (basic auth in URLs)
```

### Credential Masking

All logging automatically sanitizes:
- Passwords
- Tokens
- API keys
- Credentials in URLs

**Implementation**:
```typescript
Logger.logRequest(method, url);  // URL credentials automatically masked
Logger.error(message, error);     // Error messages automatically sanitized
```

---

## Security Best Practices

### For Users

1. **Always use HTTPS** in production
   - Enable SSL certificate validation
   - Never use `allowUnauthorizedCerts` in production

2. **Use strong credentials**
   - Complex passwords
   - Rotate credentials regularly
   - Use SAP's built-in authentication

3. **Limit permissions**
   - Use service accounts with minimal permissions
   - Follow principle of least privilege

4. **Monitor activity**
   - Enable debug logging in development only
   - Review SAP transaction logs (/IWFND/ERROR_LOG)

### For Developers

1. **Input validation is automatic**
   - All inputs are validated before processing
   - Don't bypass validation functions

2. **Use provided security utilities**
   ```typescript
   import { validateJsonInput, validateEntityKey } from './SecurityUtils';
   ```

3. **Never log sensitive data**
   ```typescript
   Logger.debug('Processing order', { orderId }); // ✅ Safe
   Logger.debug('User data', { password });       // ❌ Never!
   ```

4. **Test security features**
   - Run `npm test -- SecurityUtils.test.ts`
   - Add tests for new input types

---

## Security Audit

### Validation Coverage

| Layer | Protection | Status |
|-------|------------|--------|
| URL | SSRF prevention | ✅ Implemented |
| Headers | Injection prevention | ✅ Implemented |
| Entity Keys | SQL injection | ✅ Implemented |
| Filters | XSS prevention | ✅ Implemented |
| JSON | Prototype pollution | ✅ Implemented |
| JSON | Size limits | ✅ Implemented |
| Names | Injection prevention | ✅ Implemented |
| Rate | DoS prevention | ✅ Implemented |
| Errors | Data leakage | ✅ Implemented |

### Test Coverage

```bash
npm test -- SecurityUtils.test.ts

# Results:
# ✅ 61 security tests passing
# ✅ 100% coverage of validation functions
# ✅ SSRF, XSS, SQL injection, prototype pollution covered
```

### Known Limitations

1. **SSRF Protection** is best-effort
   - DNS rebinding attacks may bypass IP checks
   - Use network-level controls for complete protection

2. **Rate Limiting** is per-node-instance
   - Not shared across n8n instances
   - Consider external rate limiting for multi-instance deployments

3. **SAP-specific security**
   - SAP handles authentication and authorization
   - This node validates inputs before sending to SAP

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Report to: [Create private security advisory on GitHub]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## Compliance

This node implements security controls aligned with:

- **OWASP Top 10** - Protection against common web vulnerabilities
- **CWE Top 25** - Dangerous software errors prevention
- **SAP Security Guidelines** - SAP-specific best practices

---

## Security Changelog

### Version 0.1.0 (Current)

**Added**:
- ✅ SSRF protection with URL validation
- ✅ SQL injection prevention in entity keys
- ✅ XSS prevention in OData filters
- ✅ Prototype pollution protection in JSON
- ✅ Header injection prevention
- ✅ Rate limiting capabilities
- ✅ Input size limits (10MB JSON, 255 char names)
- ✅ Automatic credential sanitization in logs
- ✅ 61 security unit tests

**Validated**:
- All inputs sanitized before processing
- All outputs sanitized before logging
- All network requests validated for SSRF
- All user inputs validated for injection

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [SAP Security Guide](https://help.sap.com/docs/SAP_NETWEAVER/4fe29514fd584807ac9f2a04f6754767/e0b3e47bbb571014a2e1d8c479c3f5ef.html)
- [CWE Top 25](https://cwe.mitre.org/top25/)
