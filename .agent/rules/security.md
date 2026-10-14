# Security Rules

These security rules protect confidential credentials, personal data, and infrastructure integrity.

## Secret Handling

- **No Real Secrets**: Never view, read, open, print, edit, or commit real secrets, API keys, private keys, database passwords, or `.env` files.
- **`.env.example` Only**: All environment documentation, templates, and reference configs must reside exclusively in `.env.example`.
- **Placeholders**: Never invent realistic credentials. Always use obvious, unambiguous placeholders such as `replace-me`.
- **Git Tracking**: Real environment files (`.env`, `.env.*`) must remain strictly ignored in `.gitignore`, while ensuring `.env.example` is tracked.

## Logging & Data Privacy

- **No Sensitive Logs**: Never log passwords, tokens, API keys, session secrets, or full connection URIs containing credentials.
- **Personal Data Protection**: Never log or expose Personally Identifiable Information (PII) including email addresses, phone numbers, or user identification documents in application logs or test fixtures.
