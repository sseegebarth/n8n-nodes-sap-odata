/**
 * IDoc Status Tracker
 *
 * Provides comprehensive IDoc status tracking and monitoring:
 * - Query IDoc status by document number
 * - Monitor IDoc processing
 * - Error IDoc detection and handling
 * - Status history tracking
 *
 * @module IdocStatusTracker
 */

import { Logger } from '../Shared/utils/Logger';

/**
 * IDoc Status Codes
 *
 * Standard SAP IDoc status codes indicating processing state.
 *
 * @enum {number}
 * @readonly
 */
export enum IdocStatusCode {
	/** IDoc added */
	Added = 1,
	/** Passed to port OK */
	PassedToPort = 2,
	/** Passed to ALE service */
	PassedToALE = 3,
	/** Error within control record */
	ErrorControlRecord = 4,
	/** Error during translation */
	ErrorTranslation = 5,
	/** Translation OK */
	TranslationOK = 6,
	/** Error during syntax check */
	ErrorSyntax = 7,
	/** Syntax check OK */
	SyntaxOK = 8,
	/** Error during IDoc application */
	ErrorApplication = 9,
	/** IDoc is being processed */
	Processing = 10,
	/** Application document not posted */
	NotPosted = 11,
	/** Application document posted */
	Posted = 12,
	/** Error during ALE service */
	ErrorALEService = 13,
	/** Interchange file created */
	InterchangeFileCreated = 14,
	/** Interchange file being forwarded to EDI subsystem */
	ForwardingToEDI = 15,
	/** Inbound processing successful */
	InboundSuccess = 53,
	/** IDoc ready for dispatch (ALE service) */
	ReadyForDispatch = 64,
	/** Error during dispatch */
	ErrorDispatch = 65,
	/** IDoc was edited */
	Edited = 66,
}

/**
 * IDoc Status Information
 *
 * @interface IIdocStatus
 * @property {string} docnum - IDoc document number
 * @property {number} status - Status code
 * @property {string} statusText - Status description
 * @property {string} timestamp - Status timestamp
 * @property {string} [message] - Status message
 * @property {boolean} isError - Whether status indicates error
 * @property {boolean} isSuccess - Whether status indicates success
 */
export interface IIdocStatus {
	docnum: string;
	status: number;
	statusText: string;
	timestamp: string;
	message?: string;
	isError: boolean;
	isSuccess: boolean;
}

/**
 * IDoc Complete Information
 *
 * @interface IIdocInfo
 * @property {string} docnum - IDoc document number
 * @property {string} idoctyp - IDoc type
 * @property {string} mestyp - Message type
 * @property {string} direction - Direction (inbound/outbound)
 * @property {IIdocStatus[]} statusHistory - Status history
 * @property {IIdocStatus} currentStatus - Current status
 * @property {any} controlRecord - Control record (EDI_DC40)
 * @property {any[]} dataRecords - Data records (EDI_DD40)
 */
export interface IIdocInfo {
	docnum: string;
	idoctyp: string;
	mestyp: string;
	direction: '1' | '2'; // 1=outbound, 2=inbound
	statusHistory: IIdocStatus[];
	currentStatus: IIdocStatus;
	controlRecord: any;
	dataRecords: any[];
}

/**
 * Status Query Options
 *
 * @interface IStatusQueryOptions
 * @property {boolean} [includeHistory=true] - Include full status history
 * @property {boolean} [includeData=false] - Include IDoc data records
 * @property {string[]} [docnumList] - Query multiple IDocs
 * @property {string} [dateFrom] - Start date (YYYYMMDD)
 * @property {string} [dateTo] - End date (YYYYMMDD)
 */
export interface IStatusQueryOptions {
	includeHistory?: boolean;
	includeData?: boolean;
	docnumList?: string[];
	dateFrom?: string;
	dateTo?: string;
}

/**
 * IDoc Status Tracker
 *
 * Utility for tracking and monitoring IDoc status using SAP RFC functions.
 * Uses IDOC_READ_COMPLETE and related function modules.
 *
 * @class IdocStatusTracker
 *
 *
 */
export class IdocStatusTracker {
	private client: any;

	/**
	 * Creates an instance of IdocStatusTracker
	 *
	 * @param {any} client - SAP RFC client instance
	 */
	constructor(client: any) {
		this.client = client;
	}

	/**
	 * Get IDoc status by document number
	 *
	 * Queries the current status and optionally the status history
	 * for a specific IDoc document.
	 *
	 * @param {string} docnum - IDoc document number
	 * @param {IStatusQueryOptions} [options={}] - Query options
	 * @returns {Promise<IIdocInfo>} IDoc information
	 *
	 */
	async getIdocStatus(
		docnum: string,
		options: IStatusQueryOptions = {},
	): Promise<IIdocInfo> {
		const { includeHistory = true, includeData = false } = options;

		Logger.debug('Querying IDoc status', {
			module: 'IdocStatusTracker',
			docnum,
			includeHistory,
			includeData,
		});

		try {
			// Call IDOC_READ_COMPLETE to get full IDoc information
			const result = await this.client.call('IDOC_READ_COMPLETE', {
				DOCNUM: docnum,
			});

			if (!result.INT_EDIDC || result.INT_EDIDC.length === 0) {
				throw new Error(`IDoc ${docnum} not found`);
			}

			const controlRecord = result.INT_EDIDC[0];
			const dataRecords = includeData ? result.INT_EDID || [] : [];

			// Get status history using EDI_DOCUMENT_STATUS_GET_ALL
			let statusHistory: IIdocStatus[] = [];

			if (includeHistory) {
				const statusResult = await this.client.call('EDI_DOCUMENT_STATUS_GET_ALL', {
					DOCUMENT_NUMBER: docnum,
				});

				if (statusResult.IDOC_STATUS && Array.isArray(statusResult.IDOC_STATUS)) {
					statusHistory = statusResult.IDOC_STATUS.map((status: any) =>
						this.parseStatusRecord(docnum, status),
					);
				}
			}

			// Get current status from control record
			const currentStatusCode = parseInt(controlRecord.STATUS, 10);
			const currentStatus: IIdocStatus = {
				docnum,
				status: currentStatusCode,
				statusText: this.getStatusText(currentStatusCode),
				timestamp: this.formatTimestamp(controlRecord.CREDAT, controlRecord.CRETIM),
				isError: this.isErrorStatus(currentStatusCode),
				isSuccess: this.isSuccessStatus(currentStatusCode),
			};

			const idocInfo: IIdocInfo = {
				docnum,
				idoctyp: controlRecord.IDOCTYP,
				mestyp: controlRecord.MESTYP,
				direction: controlRecord.DIRECT,
				statusHistory,
				currentStatus,
				controlRecord,
				dataRecords,
			};

			Logger.info('IDoc status retrieved', {
				module: 'IdocStatusTracker',
				docnum,
				status: currentStatus.status,
				statusText: currentStatus.statusText,
			});

			return idocInfo;
		} catch (error) {
			Logger.error('Failed to get IDoc status', error as Error, {
				module: 'IdocStatusTracker',
				docnum,
			});

			throw new Error(
				`Failed to get IDoc status for ${docnum}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Query multiple IDocs by criteria
	 *
	 * Searches for IDocs matching the specified criteria.
	 * Useful for monitoring and error detection.
	 *
	 * @param {IStatusQueryOptions} options - Query criteria
	 * @returns {Promise<IIdocInfo[]>} Array of IDoc information
	 *
	 */
	async queryIdocs(options: IStatusQueryOptions = {}): Promise<IIdocInfo[]> {
		const { docnumList, dateFrom, dateTo, includeHistory = false, includeData = false } = options;

		Logger.debug('Querying IDocs', {
			module: 'IdocStatusTracker',
			docnumCount: docnumList?.length,
			dateFrom,
			dateTo,
		});

		try {
			let docnums: string[] = [];

			if (docnumList && docnumList.length > 0) {
				docnums = docnumList;
			} else if (dateFrom || dateTo) {
				// Use IDOC_SEARCH_BY_DATE to find IDocs
				const searchResult = await this.client.call('IDOC_SEARCH_BY_DATE', {
					CREDAT_FROM: dateFrom || '',
					CREDAT_TO: dateTo || '',
				});

				if (searchResult.IDOC_LIST && Array.isArray(searchResult.IDOC_LIST)) {
					docnums = searchResult.IDOC_LIST.map((idoc: any) => idoc.DOCNUM);
				}
			} else {
				throw new Error('Either docnumList or date range must be provided');
			}

			Logger.info('Found IDocs to query', {
				module: 'IdocStatusTracker',
				count: docnums.length,
			});

			// Query each IDoc
			const results: IIdocInfo[] = [];

			for (const docnum of docnums) {
				try {
					const info = await this.getIdocStatus(docnum, { includeHistory, includeData });
					results.push(info);
				} catch (error) {
					Logger.warn('Failed to get status for IDoc', {
						module: 'IdocStatusTracker',
						docnum,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			return results;
		} catch (error) {
			Logger.error('Failed to query IDocs', error as Error, {
				module: 'IdocStatusTracker',
			});

			throw new Error(
				`Failed to query IDocs: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get all error IDocs within a date range
	 *
	 * Convenience method to find all IDocs with error status.
	 *
	 * @param {string} dateFrom - Start date (YYYYMMDD)
	 * @param {string} dateTo - End date (YYYYMMDD)
	 * @returns {Promise<IIdocInfo[]>} Array of error IDocs
	 *
	 */
	async getErrorIdocs(dateFrom: string, dateTo: string): Promise<IIdocInfo[]> {
		const allIdocs = await this.queryIdocs({ dateFrom, dateTo, includeHistory: true });
		return allIdocs.filter((idoc) => idoc.currentStatus.isError);
	}

	/**
	 * Wait for IDoc to reach final status
	 *
	 * Polls the IDoc status until it reaches a final state (success or error).
	 * Useful for synchronous processing scenarios.
	 *
	 * @param {string} docnum - IDoc document number
	 * @param {number} [maxWaitMs=60000] - Maximum wait time in milliseconds
	 * @param {number} [pollIntervalMs=2000] - Poll interval in milliseconds
	 * @param {AbortSignal} [signal] - Optional abort signal to cancel polling
	 * @returns {Promise<IIdocStatus>} Final status
	 *
	 * @throws {Error} If timeout is reached or if aborted
	 *
	 */
	async waitForFinalStatus(
		docnum: string,
		maxWaitMs = 60000,
		pollIntervalMs = 2000,
		signal?: AbortSignal,
	): Promise<IIdocStatus> {
		const startTime = Date.now();

		Logger.info('Waiting for IDoc final status', {
			module: 'IdocStatusTracker',
			docnum,
			maxWaitMs,
			pollIntervalMs,
		});

		while (Date.now() - startTime < maxWaitMs) {
			// Check if aborted
			if (signal?.aborted) {
				throw new Error(`Polling aborted for IDoc ${docnum}`);
			}

			const info = await this.getIdocStatus(docnum, { includeHistory: false, includeData: false });

			// Check if final status reached
			if (this.isFinalStatus(info.currentStatus.status)) {
				Logger.info('IDoc reached final status', {
					module: 'IdocStatusTracker',
					docnum,
					status: info.currentStatus.status,
					statusText: info.currentStatus.statusText,
					waitTime: Date.now() - startTime,
				});

				return info.currentStatus;
			}

			// Wait before next poll (with abort support)
			await this.sleepAbortable(pollIntervalMs, signal);
		}

		throw new Error(`IDoc ${docnum} did not reach final status within ${maxWaitMs}ms`);
	}

	/**
	 * Parse status record from SAP
	 *
	 * @private
	 */
	private parseStatusRecord(docnum: string, statusRecord: any): IIdocStatus {
		const statusCode = parseInt(statusRecord.STATUS, 10);

		return {
			docnum,
			status: statusCode,
			statusText: this.getStatusText(statusCode),
			timestamp: this.formatTimestamp(statusRecord.CREDAT, statusRecord.CRETIM),
			message: statusRecord.STATEXT || '',
			isError: this.isErrorStatus(statusCode),
			isSuccess: this.isSuccessStatus(statusCode),
		};
	}

	/**
	 * Get human-readable status text
	 *
	 * @private
	 */
	private getStatusText(status: number): string {
		const statusTexts: Record<number, string> = {
			1: 'IDoc added',
			2: 'Passed to port OK',
			3: 'Passed to ALE service',
			4: 'Error within control record',
			5: 'Error during translation',
			6: 'Translation OK',
			7: 'Error during syntax check',
			8: 'Syntax check OK',
			9: 'Error during IDoc application',
			10: 'IDoc is being processed',
			11: 'Application document not posted',
			12: 'Application document posted',
			13: 'Error during ALE service',
			14: 'Interchange file created',
			15: 'Interchange file being forwarded to EDI subsystem',
			53: 'Inbound processing successful',
			64: 'IDoc ready for dispatch',
			65: 'Error during dispatch',
			66: 'IDoc was edited',
		};

		return statusTexts[status] || `Unknown status: ${status}`;
	}

	/**
	 * Check if status indicates error
	 *
	 * @private
	 */
	private isErrorStatus(status: number): boolean {
		const errorStatuses = [4, 5, 7, 9, 13, 65];
		return errorStatuses.includes(status);
	}

	/**
	 * Check if status indicates success
	 *
	 * @private
	 */
	private isSuccessStatus(status: number): boolean {
		const successStatuses = [12, 53];
		return successStatuses.includes(status);
	}

	/**
	 * Check if status is final (no further processing)
	 *
	 * @private
	 */
	private isFinalStatus(status: number): boolean {
		return this.isErrorStatus(status) || this.isSuccessStatus(status);
	}

	/**
	 * Format SAP date/time to ISO string
	 *
	 * @private
	 */
	private formatTimestamp(date: string, time: string): string {
		// SAP date format: YYYYMMDD
		// SAP time format: HHMMSS
		const year = date.substring(0, 4);
		const month = date.substring(4, 6);
		const day = date.substring(6, 8);
		const hour = time.substring(0, 2);
		const minute = time.substring(2, 4);
		const second = time.substring(4, 6);

		return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
	}

	/**
	 * Sleep with abort support
	 *
	 * Allows cancellation of the sleep operation via AbortSignal.
	 * Used in waitForFinalStatus to ensure timers are cleaned up properly.
	 *
	 * @private
	 * @param {number} ms - Milliseconds to sleep
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @returns {Promise<void>}
	 *
	 * @throws {Error} If aborted
	 */
	private sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new Error('Sleep aborted'));
				return;
			}

			let abortHandler: (() => void) | undefined;

			const timeout = setTimeout(() => {
				if (signal && abortHandler) {
					signal.removeEventListener('abort', abortHandler);
				}
				resolve();
			}, ms);

			if (signal) {
				abortHandler = () => {
					clearTimeout(timeout);
					reject(new Error('Sleep aborted'));
				};

				// Listen for abort event
				signal.addEventListener('abort', abortHandler, { once: true });
			}
		});
	}
}
