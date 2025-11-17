# Improvement Suggestions

## n8n Developer
- `nodes/Sap/SapOData.node.ts:1159-1163` – The cache-clear toggle currently reads `options.clearCache`, but the UI stores it under `advancedOptions.clearCache`. Point the execution check to the correct location so the switch works.
- `nodes/Shared/strategies/GetAllEntitiesStrategy.ts:26-34` – Advanced pagination controls (`continueOnFail`, `maxItems`) are pulled from the query options object. Retrieve them from `advancedOptions` to match the documented behavior.
- `nodes/Sap/DiscoveryService.ts:42-60` – The catalog discovery hands `CATALOGSERVICE_PATH` to the `uri` argument, producing a hostless URL. Pass it as the `customServicePath` argument so loadOptions requests resolve correctly.

## SAP Developer
- `nodes/Shared/strategies/FunctionImportStrategy.ts:36-78` – POST/action function imports still encode parameters in the URL. Accept JSON bodies for POST while keeping canonical URLs for GET to satisfy SAP Gateway expectations and avoid 414 errors.
- `nodes/Shared/strategies/UpdateEntityStrategy.ts:16-37` & `nodes/Shared/strategies/DeleteEntityStrategy.ts:16-35` – Add optional `If-Match`/ETag handling (defaulting to `*` if desired) so SAP’s optimistic locking works instead of returning 412 responses.
- `nodes/Sap/GenericFunctions.ts:202-248` – Extend `formatSapODataValue` to understand `Edm.Date`, `Edm.DateTimeOffset`, `Edm.TimeOfDay`, and decimal scale hints; current logic strips offsets and cannot emit literals required by many S/4HANA APIs.

## Clean Code Expert
- `nodes/Sap/SapOData.node.ts:1-1185` – Split properties, loadOptions, and execute logic into focused modules to reduce the 1.1k-line monolith and improve maintainability.
- `nodes/Shared/strategies/GetAllEntitiesStrategy.ts:26-34` – Replace `any` option bags with typed interfaces so TypeScript flags misreads like the misplaced pagination settings.
- `nodes/Shared/utils/Logger.ts:36-63` – Abstract logging behind an adapter that can leverage n8n’s logging facilities or injectable transports instead of hardcoded `console.log`.

## Architect
- `nodes/Shared/utils/CacheManager.ts:18-80` – Include credential identifiers in cache keys to prevent CSRF and metadata caches from leaking between different users sharing the same host.
- `nodes/Sap/GenericFunctions.ts:96-154` & `nodes/Shared/core/PaginationHandler.ts:24-118` – Consolidate the legacy request/pagination wrappers with the new core handler to eliminate duplicated paging logic and ensure a single enforcement point.
- `nodes/Shared/utils/Logger.ts:12-70` & `nodes/Shared/core/ApiClient.ts:120-191` – Expose structured telemetry (request duration, retries, throttling) through a shared interface so monitoring systems can consume metrics without scraping console output.
