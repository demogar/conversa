#!/usr/bin/env node
// Prints fresh random values for the secrets in .env. Run it once per
// environment and paste the output into that environment's .env file.
import { randomBytes } from 'node:crypto';

const secret = (bytes) => randomBytes(bytes).toString('base64url');

console.log(`SECRET_KEY=${secret(48)}`);
console.log(`ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
console.log(`POSTGRES_PASSWORD=${secret(24)}`);
