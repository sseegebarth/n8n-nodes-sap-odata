/**
 * Tests for ODataValueFormatter
 */

import { ODataValueFormatter } from '../../nodes/Shared/utils/ODataValueFormatter';
import { TypeDetector } from '../../nodes/Shared/utils/TypeDetector';

describe('ODataValueFormatter', () => {
	describe('format()', () => {
		describe('null and undefined', () => {
			it('should format null as "null"', () => {
				const result = ODataValueFormatter.format(null);
				expect(result).toBe('null');
			});

			it('should format undefined as "null"', () => {
				const result = ODataValueFormatter.format(undefined);
				expect(result).toBe('null');
			});
		});

		describe('boolean values', () => {
			it('should format true as "true"', () => {
				const result = ODataValueFormatter.format(true);
				expect(result).toBe('true');
			});

			it('should format false as "false"', () => {
				const result = ODataValueFormatter.format(false);
				expect(result).toBe('false');
			});

			it('should format boolean with explicit type hint', () => {
				const result = ODataValueFormatter.format(true, 'Edm.Boolean');
				expect(result).toBe('true');
			});
		});

		describe('number values', () => {
			it('should format integer', () => {
				const result = ODataValueFormatter.format(42);
				expect(result).toBe('42');
			});

			it('should format float', () => {
				const result = ODataValueFormatter.format(3.14);
				expect(result).toBe('3.14');
			});

			it('should format negative number', () => {
				const result = ODataValueFormatter.format(-100);
				expect(result).toBe('-100');
			});

			it('should format number with explicit type hint', () => {
				const result = ODataValueFormatter.format(42, 'Edm.Int32');
				expect(result).toBe('42');
			});
		});

		describe('string values', () => {
			it('should format simple string', () => {
				const result = ODataValueFormatter.format('Hello World');
				expect(result).toBe("'Hello World'");
			});

			it('should escape single quotes', () => {
				const result = ODataValueFormatter.format("O'Brien");
				expect(result).toBe("'O''Brien'");
			});

			it('should escape multiple single quotes', () => {
				const result = ODataValueFormatter.format("It's a test's string");
				expect(result).toBe("'It''s a test''s string'");
			});

			it('should format string with explicit type hint', () => {
				const result = ODataValueFormatter.format('test', 'Edm.String');
				expect(result).toBe("'test'");
			});
		});

		describe('GUID values', () => {
			it('should format GUID with auto-detection', () => {
				const guid = 'deadbeef-cafe-babe-f00d-decafbadc0de';
				const result = ODataValueFormatter.format(guid, undefined, { autoDetect: true });
				expect(result).toBe(`guid'${guid}'`);
			});

			it('should format GUID with explicit type hint', () => {
				const guid = 'DEADBEEF-CAFE-BABE-F00D-DECAFBADC0DE';
				const result = ODataValueFormatter.format(guid, 'Edm.Guid');
				expect(result).toBe(`guid'${guid.toLowerCase()}'`);
			});
		});

		describe('DateTime values', () => {
			it('should format ISO datetime string with timezone stripping (default)', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00.123Z',
					'Edm.DateTime',
				);
				expect(result).toBe("datetime'2024-01-15T10:30:00'");
			});

			it('should format Date object', () => {
				const date = new Date('2024-01-15T10:30:00Z');
				const result = ODataValueFormatter.format(date, 'Edm.DateTime');
				expect(result).toContain("datetime'2024-01-15T10:30:00");
			});

			it('should format datetime with timezone preservation', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00.123Z',
					'Edm.DateTime',
					{ timezoneHandling: 'preserve' },
				);
				expect(result).toBe("datetime'2024-01-15T10:30:00.123Z'");
			});

			it('should format datetime with UTC timezone handling', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00',
					'Edm.DateTime',
					{ timezoneHandling: 'utc' },
				);
				expect(result).toBe("datetime'2024-01-15T10:30:00Z'");
			});
		});

		describe('DateTimeOffset values', () => {
			it('should format ISO datetime with offset', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00+01:00',
					'Edm.DateTimeOffset',
				);
				expect(result).toBe("datetimeoffset'2024-01-15T10:30:00+01:00'");
			});

			it('should format ISO datetime with Z', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00Z',
					'Edm.DateTimeOffset',
				);
				expect(result).toBe("datetimeoffset'2024-01-15T10:30:00Z'");
			});
		});

		describe('Date values', () => {
			it('should format date-only string', () => {
				const result = ODataValueFormatter.format('2024-01-15', 'Edm.Date');
				expect(result).toBe('2024-01-15');
			});

			it('should format Date object as date-only', () => {
				const date = new Date('2024-01-15T00:00:00Z');
				const result = ODataValueFormatter.format(date, 'Edm.Date');
				expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			});
		});

		describe('Time values', () => {
			it('should format time-only string', () => {
				const result = ODataValueFormatter.format('10:30:00', 'Edm.TimeOfDay');
				expect(result).toBe("time'10:30:00'");
			});

			it('should extract time from ISO datetime', () => {
				const result = ODataValueFormatter.format(
					'2024-01-15T10:30:00Z',
					'Edm.TimeOfDay',
				);
				expect(result).toBe("time'10:30:00'");
			});

			it('should format Date object as time', () => {
				const date = new Date('2024-01-15T10:30:00Z');
				const result = ODataValueFormatter.format(date, 'Edm.Time');
				expect(result).toMatch(/time'\d{2}:\d{2}:\d{2}'/);
			});
		});

		describe('Decimal values', () => {
			it('should format simple decimal', () => {
				const result = ODataValueFormatter.format(12.34, 'Edm.Decimal');
				expect(result).toBe('12.34M');
			});

			it('should format decimal with scale', () => {
				const result = ODataValueFormatter.format({ value: 12.34, scale: 2 }, 'Edm.Decimal');
				expect(result).toBe('12.34M');
			});

			it('should format decimal with scale padding', () => {
				const result = ODataValueFormatter.format({ value: 12.3, scale: 3 }, 'Edm.Decimal');
				expect(result).toBe('12.300M');
			});

			it('should format decimal with zero scale', () => {
				const result = ODataValueFormatter.format({ value: 12, scale: 0 }, 'Edm.Decimal');
				expect(result).toBe('12M');
			});

			it('should preserve precision for large numbers', () => {
				const result = ODataValueFormatter.format('999999999.99', 'Edm.Decimal');
				expect(result).toBe('999999999.99M');
			});
		});
	});

	describe('TypeDetector', () => {
		describe('detectType()', () => {
			it('should detect boolean type', () => {
				const result = TypeDetector.detectType(true);
				expect(result).toBe('boolean');
			});

			it('should detect number type', () => {
				const result = TypeDetector.detectType(42);
				expect(result).toBe('number');
			});

			it('should detect Date instance', () => {
				const result = TypeDetector.detectType(new Date());
				expect(result).toBe('datetime');
			});

			it('should detect GUID from string with autoDetect', () => {
				const guid = 'deadbeef-cafe-babe-f00d-decafbadc0de';
				const result = TypeDetector.detectType(guid, { autoDetect: true, warnOnAutoDetect: false });
				expect(result).toBe('guid');
			});

			it('should detect datetime from ISO string with autoDetect', () => {
				const result = TypeDetector.detectType('2024-01-15T10:30:00', {
					autoDetect: true,
					warnOnAutoDetect: false,
				});
				expect(result).toBe('datetime');
			});

			it('should detect datetimeoffset from ISO string with timezone', () => {
				const result = TypeDetector.detectType('2024-01-15T10:30:00+01:00', {
					autoDetect: true,
					warnOnAutoDetect: false,
				});
				expect(result).toBe('datetimeoffset');
			});

			it('should detect date-only from string', () => {
				const result = TypeDetector.detectType('2024-01-15', {
					autoDetect: true,
					warnOnAutoDetect: false,
				});
				expect(result).toBe('date');
			});

			it('should detect time-only from string', () => {
				const result = TypeDetector.detectType('10:30:00', {
					autoDetect: true,
					warnOnAutoDetect: false,
				});
				expect(result).toBe('timeofday');
			});

			it('should detect decimal from object with value property', () => {
				const result = TypeDetector.detectType({ value: 12.34, scale: 2 });
				expect(result).toBe('decimal');
			});

			it('should return undefined when autoDetect is false', () => {
				const result = TypeDetector.detectType('some string', { autoDetect: false });
				expect(result).toBeUndefined();
			});

			it('should default to string when autoDetect is true', () => {
				const result = TypeDetector.detectType('some random string', {
					autoDetect: true,
					warnOnAutoDetect: false,
				});
				expect(result).toBe('string');
			});
		});

		describe('normalizeTypeHint()', () => {
			it('should normalize Edm.DateTime to datetime', () => {
				const result = TypeDetector.normalizeTypeHint('Edm.DateTime');
				expect(result).toBe('datetime');
			});

			it('should normalize datetime to datetime', () => {
				const result = TypeDetector.normalizeTypeHint('datetime');
				expect(result).toBe('datetime');
			});

			it('should normalize DateTime (mixed case) to datetime', () => {
				const result = TypeDetector.normalizeTypeHint('DateTime');
				expect(result).toBe('datetime');
			});
		});

		describe('isDateTimeType()', () => {
			it('should identify datetime types', () => {
				expect(TypeDetector.isDateTimeType('datetime')).toBe(true);
				expect(TypeDetector.isDateTimeType('datetimeoffset')).toBe(true);
				expect(TypeDetector.isDateTimeType('date')).toBe(true);
				expect(TypeDetector.isDateTimeType('time')).toBe(true);
				expect(TypeDetector.isDateTimeType('timeofday')).toBe(true);
			});

			it('should not identify non-datetime types', () => {
				expect(TypeDetector.isDateTimeType('string')).toBe(false);
				expect(TypeDetector.isDateTimeType('number')).toBe(false);
				expect(TypeDetector.isDateTimeType('boolean')).toBe(false);
			});
		});

		describe('isNumericType()', () => {
			it('should identify numeric types', () => {
				expect(TypeDetector.isNumericType('number')).toBe(true);
				expect(TypeDetector.isNumericType('int32')).toBe(true);
				expect(TypeDetector.isNumericType('decimal')).toBe(true);
				expect(TypeDetector.isNumericType('double')).toBe(true);
			});

			it('should not identify non-numeric types', () => {
				expect(TypeDetector.isNumericType('string')).toBe(false);
				expect(TypeDetector.isNumericType('datetime')).toBe(false);
				expect(TypeDetector.isNumericType('boolean')).toBe(false);
			});
		});
	});
});
