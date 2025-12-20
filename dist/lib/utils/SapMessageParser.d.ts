import { IDataObject } from 'n8n-workflow';
export declare enum SapMessageSeverity {
    Success = "success",
    Information = "info",
    Warning = "warning",
    Error = "error",
    Abort = "abort"
}
export interface ISapMessage {
    code: string;
    message: string;
    severity: SapMessageSeverity;
    target?: string;
    details?: string;
    longText?: string;
    technicalDetails?: IDataObject;
}
export declare class SapMessageParser {
    static parseSapMessageHeader(headerValue: string): ISapMessage[];
    static parseSapErrorResponse(responseBody: unknown): ISapMessage[];
    private static mapSeverity;
    static extractMessageClass(code: string): string;
    static isBusinessError(message: ISapMessage): boolean;
    static isTechnicalError(message: ISapMessage): boolean;
    static formatMessages(messages: ISapMessage[]): string;
    private static getSeverityIcon;
    static extractAllMessages(headers: IDataObject | undefined, body: unknown): ISapMessage[];
    static getErrorDescription(message: ISapMessage): string;
}
