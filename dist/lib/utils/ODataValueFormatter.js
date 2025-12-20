"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ODataValueFormatter = void 0;
exports.formatODataValue = formatODataValue;
const formatters_1 = require("./formatters");
const TypeDetector_1 = require("./TypeDetector");
class ODataValueFormatter {
    static format(value, typeHint, options = {}) {
        if (value === null || value === undefined) {
            return 'null';
        }
        let type;
        if (typeHint) {
            type = TypeDetector_1.TypeDetector.normalizeTypeHint(typeHint);
        }
        else {
            type = TypeDetector_1.TypeDetector.detectType(value, options);
        }
        if (!type) {
            type = 'string';
        }
        const formatter = this.formatters.get(type);
        if (!formatter) {
            throw new Error(`No formatter available for type: ${type}`);
        }
        return formatter.format(value, options);
    }
    static registerFormatter(type, formatter) {
        this.formatters.set(type, formatter);
    }
    static getFormatters() {
        return new Map(this.formatters);
    }
}
exports.ODataValueFormatter = ODataValueFormatter;
ODataValueFormatter.formatters = new Map([
    ['boolean', new formatters_1.BooleanFormatter()],
    ['datetime', new formatters_1.DateTimeFormatter()],
    ['datetimeoffset', new formatters_1.DateTimeOffsetFormatter()],
    ['date', new formatters_1.DateFormatter()],
    ['time', new formatters_1.TimeFormatter()],
    ['timeofday', new formatters_1.TimeFormatter()],
    ['guid', new formatters_1.GuidFormatter()],
    ['decimal', new formatters_1.DecimalFormatter()],
    ['number', new formatters_1.NumberFormatter()],
    ['int16', new formatters_1.NumberFormatter()],
    ['int32', new formatters_1.NumberFormatter()],
    ['int64', new formatters_1.NumberFormatter()],
    ['single', new formatters_1.NumberFormatter()],
    ['double', new formatters_1.NumberFormatter()],
    ['byte', new formatters_1.NumberFormatter()],
    ['string', new formatters_1.StringFormatter()],
]);
function formatODataValue(value, typeHint, options) {
    return ODataValueFormatter.format(value, typeHint, options);
}
