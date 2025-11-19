# Changelog

All notable changes to the n8n SAP OData Community Node will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **🎯 Zero External Dependencies**: Removed `xml2js` and `xmlbuilder2` dependencies
  - Implemented native XML parsing for OData $metadata (MetadataParser)
  - Implemented native XML parsing for IDoc documents (IdocWebhookFunctions)
  - Implemented native XML building for IDoc documents (IdocFunctions)
  - Reduced bundle size and improved compatibility with n8n community node requirements
  - Maintained 100% backward compatibility - no API changes

### Benefits
- ✅ Smaller bundle size (removed 7 npm packages)
- ✅ Faster installation and deployment
- ✅ Better compliance with n8n community node guidelines
- ✅ No dependency security vulnerabilities from XML libraries
- ✅ Improved performance for XML operations

## [1.4.0] - 2024-10-26

### Added
- **🔔 SAP OData Webhook Trigger Node**: Real-time event notifications from SAP systems
  - Webhook URL generation and management
  - Multiple authentication methods (Header Auth, Query String, None)
  - Event filtering by entity type and operation
  - SAP date format parsing (/Date(...)/ → ISO 8601)
  - Changed field extraction for update events
  - IP whitelist support for security
  - Custom response body configuration
  - Payload format validation
- **Webhook Documentation**: Comprehensive WEBHOOK_GUIDE.md with setup instructions, ABAP examples, and testing guide

### Benefits of Webhook Integration
- ⚡ Near-instant notifications (< 1 second latency vs. 1-5 minute polling)
- 📉 Reduced SAP system load (no continuous polling)
- 💰 Lower n8n resource usage (event-driven architecture)
- 🎯 Guaranteed event delivery (push-based)

## [1.3.1] - 2024-10-26

### Added
- **Enhanced Connection Testing**: Improved credential test validates SAP Gateway Catalog Service with proper SAP headers (sap-client, sap-language)
- **Code Architecture**: Refactored to shared module structure in preparation for v2.0
  - `nodes/Shared/core/` - Core API modules (ApiClient, PaginationHandler, QueryBuilder, RequestBuilder)
  - `nodes/Shared/utils/` - Utility modules (CacheManager, ErrorHandler, Logger, Security, etc.)
  - `nodes/Shared/strategies/` - Operation strategy pattern implementation
- **ConnectionTest Module**: Comprehensive connection testing infrastructure ready for future enhancements

### Changed
- Reorganized codebase into Shared and node-specific directories
- Updated all imports to use shared modules
- Improved test coverage for shared modules

## [1.3.0] - 2024-10-24

### Added
- **Service Discovery**: Automatic discovery of available OData services from SAP Gateway Catalog Service
- **Service Category Filter**: Filter services by type (SAP Standard APIs, Custom Services, Other)
- **Service Path Dropdown**: Select services from a dynamically populated list
- **Enhanced Entity Key Validation**: Support for complex entity keys with letters, numbers, underscores, hyphens, and dots
- **404 Cache Invalidation**: Automatic cache clearing on 404 errors for metadata and CSRF tokens
- **Type Conversion**: Automatic conversion of SAP data types to JavaScript native types

### Fixed
- Type conversion bug with numeric strings
- Entity key regex validation for complex keys
- Cache invalidation logic for non-existent resources

### Documentation
- Complete technical documentation in DOCUMENTATION.md
- Architecture overview and design patterns
- Performance optimization guidelines
- Known limitations and workarounds

## [1.2.0] - 2024-10-22

### Added
- **Streaming Mode**: Memory-efficient data fetching for large datasets
- **Advanced Error Handling**: Centralized error handler with detailed SAP error messages
- **Retry Logic**: Configurable retry mechanism with exponential backoff
- **Throttling**: Rate limiting to prevent overwhelming SAP Gateway
- **Connection Pooling**: HTTP connection reuse for better performance
- **Comprehensive Logging**: Debug logging with sanitization for security

### Changed
- Refactored to Strategy Pattern for operation handling
- Improved modular architecture with separate core modules
- Enhanced security with input validation and sanitization

## [1.1.0] - 2024-10-20

### Added
- **Custom Entity Set Mode**: Manual entity set name input for restrictive SAP systems
- **Custom Function Import Mode**: Manual function import name input
- **Metadata Caching**: Cache entity sets and function imports for better performance
- **CSRF Token Caching**: Reuse CSRF tokens across requests
- **SAP-specific Headers**: Support for sap-client and sap-language headers
- **Custom Headers**: JSON-based custom header configuration

### Fixed
- Metadata parsing for services with complex schemas
- CSRF token handling for services requiring tokens
- SSL certificate validation handling

## [1.0.0] - 2024-10-15

### Added
- Initial release of SAP OData Community Node
- **Entity Operations**: Get, Get All, Create, Update, Delete
- **Function Import Support**: Execute SAP function imports
- **OData Query Options**: $select, $expand, $filter, $orderby, $skip, $count, $search, $apply
- **Authentication**: Basic Auth and No Auth support
- **Pagination**: Automatic pagination with configurable batch sizes
- **SSL Support**: Option to ignore SSL certificate validation
- **Basic Metadata Support**: Load entity sets and function imports from $metadata

### Security
- Password fields properly secured
- SSL certificate validation (with option to disable)
- Basic input validation

---

## Version History

- **v1.3.0**: Service Discovery & Category Filtering
- **v1.2.0**: Performance & Resilience Features
- **v1.1.0**: Custom Modes & Caching
- **v1.0.0**: Initial Release

## Future Roadmap

### v2.0.0 (Planned)
- Metadata-based field discovery and selection
- Navigation property explorer
- Advanced filter builder UI
- Property-level type information
- Dynamic field suggestions

### Future Considerations
- OAuth2 authentication support
- OData $batch operations
- Delta link support for change tracking
- SAP RFC/BAPI integration (separate node)
- Template library for common scenarios
