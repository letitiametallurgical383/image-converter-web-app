# Documentation

This directory is the authoritative documentation hub for Image Converter Web App.

## Documentation Map

- **`architecture.md`**: System architecture, data flow, security model, worker model, state boundaries, risks, and extension points.
- **`developer-guide.md`**: Code map, internal API notes, validation workflow, AI/developer continuation context, feature workflow, and critical project rules.

The root `README.md` is intentionally shorter. It is the public entry point for setup, features, commands, current limits, and links into this directory.

## Project Status

- **Version**: `0.1.0 - Beta Version` from `PROJECT_VERSION`.
- **Runtime model**: Browser-native, local-first image conversion.
- **Validation baseline**: Last verified with `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run audit` on 2026-05-11.
- **Build baseline**: Not asserted here. Run `bun run build` only when a release/build check is explicitly required.

## Source of Truth

- **Dependencies and scripts**: `package.json`.
- **Version label**: `PROJECT_VERSION`.
- **Runtime limits**: `src/core/constants.ts`.
- **Core contracts**: `src/core/types.ts`.
- **Validation rules**: `src/domain/validation.ts`.
- **Conversion orchestration**: `src/presentation/hooks/useConverter.ts`.
- **Worker execution**: `src/data/workerPool.ts`, `src/data/workerClient.ts`, and `src/workers/converter.worker.ts`.
- **Metadata behavior**: `src/workers/metadata.ts`.

## Documentation Policy

- Do not claim legal, security, or accessibility certification from source code alone.
- Do not claim exact production bundle size unless a fresh build was run.
- Do not claim full WCAG conformance without manual assistive technology testing and automated accessibility checks.
- Keep test counts synchronized with the latest successful `bun run test` output.
- Keep streaming references precise: separate chunked streaming conversion is disabled; memory checks still run before worker conversion.
- Keep duplicate documentation out of the root directory. Add new detailed docs here and link from the root `README.md`.

## Additional Information

- This repository has no upload API, cookies, analytics, or tracking code.
- Metadata preservation can retain sensitive camera/location/creator data when enabled.
- Production readiness requires release-specific browser testing, accessibility testing, and deployment-header verification.
