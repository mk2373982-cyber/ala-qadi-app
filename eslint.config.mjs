import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts', 'public/sw.js'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // The API routes throw Arabic `Error` objects that are surfaced to users
      // verbatim by design; narrowing every thrown value adds no safety here.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
