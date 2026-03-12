# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0-beta.1] - 2026-03-08

### Added
- V4 Action, Function, and ActionImport support alongside V2 FunctionImports
- ResourceLocator for Function Import selection (searchable dropdown with type labels)
- ResourceLocator for Service Path selection with SAP Gateway Catalog auto-discovery
- ResourceLocator for Entity Set selection from service metadata
- Service catalog caching for improved load option performance
- Callable type encoding in value format (`FunctionImport::Name`, `Action::Name`, `Function::Name`)
- Auto-detection of HTTP method based on callable type (POST for Actions/FunctionImports, GET for Functions)

### Changed
- Function Import parameters: V2 FunctionImports send parameters in URL (query string), V4 Actions send parameters in request body
- Error messages now pass through original SAP error text instead of generic "Invalid OData syntax"
- Webhook Trigger node renamed from `SapODataWebhook` to `SapODataTrigger` (n8n naming convention)
- Replaced all `any` types with concrete TypeScript types across the codebase
- All ESLint errors resolved (105 errors fixed)
- Author updated to Sascha Seegebarth <sascha.seegebarth@avanai.io>

### Fixed
- V2 FunctionImport POST: parameters now correctly sent as URL query string instead of request body
- V2 FunctionImport POST: uses query string format (`?param=value`) instead of canonical format (`(param=value)`) which caused "Invalid URI segment" errors
- OData V4 pagination: only follows `@odata.nextLink`, no `$skip` fallback
- No forced `$top` in PaginationHandler — server decides response size

## [0.4.0] - 2025-12-15

### Added
- Webhook trigger node for real-time SAP event processing
- OAuth2 credential support for SAP Cloud/BTP systems
- Batch operations (Create, Update, Delete)
- Function Import / Action support
- Navigation property expansion with nested query options
- OData version auto-detection from service metadata
- Automatic pagination with configurable batch size
- HMAC signature validation for webhook authentication
- Dark mode icon variant

### Changed
- Migrated to `@n8n/node-cli` build toolchain
- Improved error messages with SAP-specific context
- Enhanced CSRF token handling for write operations

### Fixed
- CSRF token handling for update operations
- DELETE response handling for various SAP backends
- OData version detection edge cases
- 404 error messages with actionable hints
- URL generation for entity key formatting
- `$count` handling across OData V2/V4
- Apostrophe escaping in filter values

## [0.3.0] - 2025-10-01

### Added
- SAP Cloud Platform support
- Release scripts and GitHub workflow

### Fixed
- Multiple stability improvements for pagination and error recovery

## [0.2.1] - 2025-08-15

### Fixed
- URL validation for credential testing
- Private IP access support via configuration for on-premise SAP systems

## [0.2.0] - 2025-07-01

### Added
- Get All operation with automatic pagination
- OData query options ($filter, $select, $expand, $orderby, $top, $skip)
- Type conversion for SAP date/time formats
- Metadata removal for cleaner output

### Fixed
- Secure URL building with proper encoding

## [0.1.0] - 2025-05-01

### Added
- Initial release
- CRUD operations (Get, Get All, Create, Update, Delete)
- Basic Auth credential support
- OData V2 and V4 protocol support
- SSL certificate validation bypass for development
- SAP Client and Language header support
