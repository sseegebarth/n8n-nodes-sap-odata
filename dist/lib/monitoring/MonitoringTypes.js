"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDOC_STATUS_DESCRIPTIONS = exports.IdocStatus = exports.ProcessingStatus = exports.IntegrationType = exports.LogLevel = void 0;
exports.getIdocStatusDescription = getIdocStatusDescription;
exports.isSuccessStatus = isSuccessStatus;
exports.isErrorStatus = isErrorStatus;
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var IntegrationType;
(function (IntegrationType) {
    IntegrationType["ODATA"] = "odata";
    IntegrationType["IDOC_SEND"] = "idoc-send";
    IntegrationType["IDOC_RECEIVE"] = "idoc-receive";
    IntegrationType["RFC"] = "rfc";
    IntegrationType["BAPI"] = "bapi";
})(IntegrationType || (exports.IntegrationType = IntegrationType = {}));
var ProcessingStatus;
(function (ProcessingStatus) {
    ProcessingStatus["RECEIVED"] = "received";
    ProcessingStatus["PARSING"] = "parsing";
    ProcessingStatus["PARSED"] = "parsed";
    ProcessingStatus["VALIDATING"] = "validating";
    ProcessingStatus["PROCESSING"] = "processing";
    ProcessingStatus["COMPLETED"] = "completed";
    ProcessingStatus["ERROR"] = "error";
    ProcessingStatus["WARNING"] = "warning";
})(ProcessingStatus || (exports.ProcessingStatus = ProcessingStatus = {}));
var IdocStatus;
(function (IdocStatus) {
    IdocStatus["CREATED"] = "01";
    IdocStatus["PASSED_TO_APP"] = "02";
    IdocStatus["DATA_ERROR"] = "03";
    IdocStatus["SYSTEM_ERROR"] = "04";
    IdocStatus["APP_DOC_CREATED"] = "51";
    IdocStatus["APP_DOC_POSTED"] = "53";
    IdocStatus["ERROR_IN_APP"] = "56";
    IdocStatus["READY_TO_DISPATCH"] = "30";
    IdocStatus["DISPATCHED"] = "03";
    IdocStatus["ERROR_DISPATCHING"] = "12";
    IdocStatus["READY_TO_TRANSFER"] = "64";
    IdocStatus["SENT_TO_EDI"] = "02";
    IdocStatus["ARCHIVED"] = "99";
})(IdocStatus || (exports.IdocStatus = IdocStatus = {}));
exports.IDOC_STATUS_DESCRIPTIONS = {
    '01': 'IDoc created',
    '02': 'Error passing data to port',
    '03': 'Data passed to port OK',
    '04': 'Error within control information',
    '05': 'Error during translation',
    '06': 'Translation OK',
    '07': 'Error during syntax check',
    '08': 'Syntax check OK',
    '09': 'Error during interchange handling',
    '10': 'Interchange handling OK',
    '11': 'Error during dispatch',
    '12': 'Dispatch OK',
    '29': 'Processing despite error',
    '30': 'IDoc ready for dispatch (ALE service)',
    '31': 'Error - no further processing',
    '32': 'IDoc was edited',
    '33': 'Original of an IDoc which was edited',
    '34': 'Error in ALE service',
    '35': 'IDoc reloaded from archive',
    '37': 'IDoc added incorrectly',
    '38': 'IDoc archived',
    '39': 'IDoc is component of a package (EDI)',
    '40': 'Application document created',
    '41': 'Application document not created',
    '42': 'Application document partially posted',
    '43': 'IDoc ready to be transferred to application',
    '50': 'IDoc added',
    '51': 'Application document created',
    '52': 'Application document not fully posted',
    '53': 'Application document posted',
    '56': 'IDoc with errors added',
    '60': 'Error during syntax check of EDI_DC',
    '61': 'Error during syntax check of data',
    '62': 'IDoc passed to application',
    '63': 'Error passing IDoc to application',
    '64': 'IDoc ready to be passed to application',
    '65': 'Error in ALE service',
    '66': 'IDoc is waiting for predecessor IDoc',
    '69': 'IDoc was edited',
    '70': 'Original of an IDoc which was edited',
    '71': 'IDoc reloaded from archive',
    '74': 'IDoc archived',
    '75': 'IDoc was converted to the new format',
};
function getIdocStatusDescription(status) {
    return exports.IDOC_STATUS_DESCRIPTIONS[status] || `Unknown status: ${status}`;
}
function isSuccessStatus(status) {
    const successStatuses = ['03', '08', '10', '12', '30', '51', '53', '64'];
    return successStatuses.includes(status);
}
function isErrorStatus(status) {
    const errorStatuses = ['02', '04', '05', '07', '09', '11', '31', '34', '41', '56', '60', '61', '63', '65'];
    return errorStatuses.includes(status);
}
