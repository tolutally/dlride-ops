# DLride Ops API contract

This directory contains contract artifacts only. It contains no endpoint
implementation, framework code, database queries, authentication flow, email
handling, or user interface code.

```text
api/
├── README.md
└── openapi.yaml
```

`openapi.yaml` is the authoritative OpenAPI 3.1 specification for the API.

## Conventions

- Request and response field names use `snake_case` to match the data contract.
- All JSON success responses use `{ "success": true, "data": ... }`.
- All JSON failures use `{ "success": false, "error": { "code", "message" } }`.
- Validation failures may add `error.details` with field-specific messages.
- `POST /applications` is public and accepts `multipart/form-data` with an
  empty `company_name` honeypot and a `cf-turnstile-response` token.
- The public form's Turnstile widget must use site key
  `0x4AAAAAAEKp8XOfnJ4A6Dwp` and `data-action="turnstile-spin-v2"`.
- Siteverify runs only in the server function with `TURNSTILE_SECRET`; the
  secret is never accepted from or returned to a browser.
- Application submission is limited to five attempts per source IP per rolling
  hour and returns `429` with `Retry-After` when exhausted.
- Each required document is limited to 10 MB. Accepted content is JPEG, PNG, or
  PDF, determined from file signatures rather than browser metadata.
- Application management and document endpoints require the contract's staff
  bearer authorization marker. Authentication implementation is out of scope.
- Signed document URLs include an expiry timestamp. Raw storage paths and
  permanent public URLs are not part of the response contract.
- Customer, fleet, rental, and renewal operations are reserved placeholders and
  return `501 Not Implemented` until their resource contracts are finalized.

## HTTP status codes

| Status | Meaning |
| --- | --- |
| `200` | Successful read or update |
| `201` | Application created |
| `400` | Malformed request or invalid query/path parameter |
| `401` | Staff authentication required |
| `403` | Authenticated caller is not authorized as staff |
| `404` | Application or required document not found |
| `413` | Upload exceeds the configured server limit |
| `415` | Unsupported request or document media type |
| `422` | Server-side validation failed |
| `429` | Source IP exceeded five application attempts per rolling hour |
| `500` | Unexpected server failure |
| `501` | Reserved placeholder endpoint is not implemented |

## Payment methods

`payment_method` is required and accepts exactly `cash`, `e-transfer`, or
`card`.
