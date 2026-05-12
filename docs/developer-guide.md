# Developer and AI Continuation Guide

## Purpose

This guide is for developers and AI assistants continuing the project. It explains what to read first, how the codebase is organized, how to add changes safely, and which project-specific constraints must not be violated.

## Quick Context

- **Project**: Image Converter Web App.
- **Version**: `0.1.0 - Beta Version`.
- **Type**: Browser-native image conversion app.
- **Runtime**: React + TypeScript + Vite + Web Workers + WASM encoders.
- **State**: Zustand.
- **Validation**: Bun scripts, TypeScript strict mode, Biome, Vitest.
- **Important rule**: do not run a production build unless explicitly requested.

## Start Here

Read in this order:

1. `README.md` in the root directory.
2. `docs/architecture.md`.
3. This guide.
4. The files directly related to your change.
5. Existing tests for the touched layer.

Do not start by changing code before understanding the relevant data flow and invariants.

## Important Commands

Use Bun first.

```bash
bun run lint
bun run typecheck
bun run test
bun run audit
```

Build only when explicitly requested:

```bash
bun run build
```

## Current Validation Baseline

Last verified on 2026-05-11:

- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun run test`: passed with 24 test files and 289 tests.
- `bun run audit`: passed with no vulnerabilities.

This baseline is not a guarantee after future dependency or source changes. Re-run the relevant commands after changes.

## Code Map

### Core

`src/core/`

- `types.ts`: shared contracts for settings, batch items, source files, artifacts, worker messages, presets, and output formats.
- `constants.ts`: supported formats, MIME maps, size limits, memory limits, storage keys, defaults, and magic-byte constants.
- `errors.ts`: typed errors and error-to-message conversion.

Change here only when the shared contract or global constraints really change.

### Domain

`src/domain/`

- `validation.ts`: file validation, settings validation, crop validation, preset parsing, MIME/signature compatibility.
- `formats.ts`: output format capability helpers.
- `crop.ts`: percentage crop to canvas rectangle.
- `naming.ts`: filename sanitization, find/replace, prefixing, extension switching, collision handling.

Domain code should stay pure. Do not add browser I/O, React, Zustand, or worker code here.

### Data

`src/data/`

- `workerClient.ts`: wrapper around a single conversion worker.
- `workerPool.ts`: worker lifecycle, queueing, cancellation, recycling.
- `streamingConverter.ts`: memory estimation facade (`estimateMemoryUsage`). `shouldUseStreaming()` is intentionally kept returning `false` — it documents the design decision that conversion always uses the worker pipeline.
- `zip.ts`: JSZip adapter.
- `storage.ts`: localStorage adapter.
- `presets.ts`: preset import/export/persistence.
- `download.ts`: Blob download adapter.

Data code bridges domain rules and browser APIs. Keep API surfaces small and tested.

### Presentation

`src/presentation/`

- `pages/HomePage.tsx`: main layout and modal orchestration.
- `store/converterStore.ts`: Zustand state and persistence writes.
- `hooks/useConverter.ts`: batch conversion orchestration.
- `hooks/useImageDrop.ts`: file selection validation and queue insertion.
- `hooks/useBatchDownload.ts`: artifact and ZIP downloads.
- `hooks/usePresets.ts`: preset CRUD and import/export.
- `hooks/useTheme.ts`: theme preference and system resolution.
- `components/`: UI features.
- `components/ui/`: reusable primitives.

Presentation must preserve accessibility semantics and mode-safe state updates.

### Workers

`src/workers/`

- `converter.worker.ts`: decode, crop, encode, metadata preservation, progress responses.
- `metadata.ts`: binary metadata extraction/injection.
- `binaryConstants.ts`: binary parsing constants.

Worker code is high risk. Add focused tests for binary parsing, conversion protocol, metadata, and error behavior.

### Utils

`src/utils/`

Shared utilities: debounce, byte formatting, IDs, idle callback wrapper, logger, and concurrency queue.

Note: `idle.ts` (`yieldToIdle`, `nextFrame`) exists as infrastructure but is not currently used in production code.

Utilities should remain generic and avoid project-layer dependencies.

## Internal API Notes

### Conversion Hook

`useConverter()` returns:

```typescript
{
  runBatch: () => Promise<void>;
  cancelBatch: () => void;
  artifacts: ConvertedArtifact[];
  doneItems: BatchItem[];
}
```

Critical invariants:

- Snapshot settings at batch start.
- Guard async updates by run token and active IDs.
- Use memory estimation before worker conversion.
- Cancellation must stop queued tasks and prevent stale updates.

### Worker Pool

`WorkerPool.convert()` accepts bytes, MIME, settings, original name, optional abort signal, and progress callback.

Critical invariants:

- Queued task abort must reject and be removed from the queue.
- Active cancellation must not leak stale worker results.
- Pool termination must clean queued tasks and workers.

### File Validation

`validateImageFile(file)` must combine size, declared MIME, binary signature, and compatibility checks. Do not relax this to extension-only checks.

### Metadata

Metadata preservation is opt-in through `settings.keepMetadata`.

Do not add metadata behavior without considering:

- GPS/privacy leakage.
- Format-specific binary layout.
- Metadata integrity warnings.
- Binary fixture tests.

## Feature Workflow

Before implementing:

1. Identify the layer that owns the change.
2. Read existing tests for that layer.
3. Check source contracts in `src/core/types.ts` and `src/core/constants.ts`.
4. Check whether the feature affects security, privacy, memory, accessibility, or cancellation.
5. Decide where tests must be added.

During implementation:

1. Keep code readable without comments unless comments are explicitly requested.
2. Avoid duplicate logic; extract reusable domain or UI functions only when there is real reuse.
3. Preserve strict typing.
4. Keep imports at the top of files.
5. Keep UI accessible: labels, focus states, keyboard behavior, ARIA states where needed.

After implementation:

1. Run `bun run lint`.
2. Run `bun run typecheck`.
3. Run focused tests or `bun run test` depending on scope.
4. Run `bun run audit` if dependencies changed or a security-sensitive change was made.
5. Update docs if behavior, architecture, limits, commands, or dependencies changed.

## How to Add Common Changes

### Add an Output Format

Touch points usually include:

- `src/core/types.ts`
- `src/core/constants.ts`
- `src/domain/formats.ts`
- `src/workers/converter.worker.ts`
- UI select options in presentation components
- worker/domain tests
- `README.md` and `docs/architecture.md`

Risks:

- MIME mismatch.
- Encoder lazy-loading failure.
- Metadata behavior assumptions.
- Accessibility label drift.

### Add a Setting

Touch points usually include:

- `ConverterSettings` in `src/core/types.ts`.
- `DEFAULT_SETTINGS` in `src/core/constants.ts`.
- `validateSettings()` in `src/domain/validation.ts`.
- `converterStore.ts` persistence path.
- Relevant UI controls.
- Preset parsing and tests.

Risks:

- Breaking old presets.
- Invalid persisted values.
- Stale closure behavior in conversion batches.

### Change File Validation

Touch points usually include:

- `src/domain/validation.ts`.
- `src/core/constants.ts` if signatures or MIME lists change.
- `src/__tests__/domain/validation.test.ts`.

Risks:

- Allowing spoofed content.
- Rejecting valid HEIC/AVIF variants by brand too narrowly.
- Trusting declared MIME too much.

### Change Cancellation

Touch points usually include:

- `src/presentation/hooks/useConverter.ts`.
- `src/data/workerPool.ts`.
- `src/data/workerClient.ts`.
- worker client/pool tests.

Risks:

- Stale worker results updating UI.
- Queue tasks starting after abort.
- Worker leaks.
- Promise never settling.

### Change Metadata Behavior

Touch points usually include:

- `src/workers/metadata.ts`.
- `src/workers/converter.worker.ts`.
- binary fixtures in `src/__tests__/fixtures/`.
- worker metadata tests.

Risks:

- Corrupting binary output.
- Incorrect CRC/segment length/box size.
- Preserving private metadata unexpectedly.
- Overclaiming format support in docs.

## Testing Strategy

Use focused tests first, then broader validation.

Important test areas:

- `src/__tests__/domain/validation.test.ts`: file security and settings validation.
- `src/__tests__/data/workerPool.test.ts`: queueing, recycling, cancellation.
- `src/__tests__/data/workerClient.test.ts`: worker message handling and cancellation.
- `src/__tests__/data/streamingConverter.test.ts`: memory estimate and disabled streaming behavior.
- `src/__tests__/workers/*`: binary metadata behavior.
- `src/__tests__/fixtures/binary.ts`: binary fixture builders.

When changing binary logic, add tests before broad refactors.

## Documentation Rules

- Root `README.md` stays concise and user-facing.
- Detailed documentation belongs in `docs/`.
- Avoid duplicate generated summaries.
- Update `docs/architecture.md` for data flow, layer, security, worker, and state changes.
- Update this guide for continuation context, workflow, or recurring pitfalls.
- Do not claim exact build size unless a fresh build was explicitly run.
- Do not claim compliance or accessibility certification from code alone.

## AI Assistant Rules for This Project

When continuing this project:

- Use Bun commands where available.
- Do not run build unless the user explicitly asks.
- Do not access sensitive `.env` files; use `.env.example` or non-sensitive env references only.
- Do not add code comments unless explicitly requested.
- Prefer implementation over suggestion when the user asks for fixes.
- Start with codebase exploration when the affected area is unclear.
- Validate after meaningful code changes.
- Do not hide or manipulate build/test errors; fix root causes.
- Preserve clean architecture and accessibility requirements.

## Known Limits

- Large files may be rejected by memory estimation.
- Separate chunked streaming conversion is disabled.
- AVIF output does not preserve metadata (EXIF, XMP, IPTC, ICC).
- GIF animation conversion is not supported; only still-image behavior is expected.
- Full WCAG conformance requires manual and automated accessibility testing beyond unit tests.
- Compliance programs require operational controls outside this source repository.
