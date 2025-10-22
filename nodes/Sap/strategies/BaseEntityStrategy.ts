/**
 * @deprecated This class has been deprecated in favor of CrudStrategy.
 *
 * BaseEntityStrategy and CrudStrategy contained duplicate code with identical functionality.
 * All strategies should now extend CrudStrategy which provides:
 * - All methods from BaseEntityStrategy
 * - Enhanced error handling via handleOperationError()
 * - JSON validation via validateAndParseJson()
 * - Response formatting via formatSuccessResponse()
 * - Improved V4 OData support in extractResult()
 * - Operation logging support
 *
 * Migration Guide:
 * 1. Change: `extends BaseEntityStrategy` to `extends CrudStrategy`
 * 2. Import: `import { CrudStrategy } from './base/CrudStrategy'`
 * 3. All existing methods work unchanged (getEntitySet, validateAndFormatKey, getQueryOptions, extractResult)
 *
 * This file is kept for backward compatibility during Phase 8 migration.
 * It will be removed in a future version.
 *
 * @see CrudStrategy in ./base/CrudStrategy.ts for the unified base class
 */

import { CrudStrategy } from './base/CrudStrategy';

/**
 * @deprecated Use CrudStrategy instead
 * This is now just an alias to CrudStrategy for backward compatibility
 */
export abstract class BaseEntityStrategy extends CrudStrategy {
	// All functionality inherited from CrudStrategy
	// No additional implementation needed
}
