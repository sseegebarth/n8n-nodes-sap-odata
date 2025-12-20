import { ILoadOptionsFunctions } from 'n8n-workflow';
export interface ISapODataService {
    id: string;
    title: string;
    technicalName: string;
    servicePath: string;
    version: string;
    description?: string;
}
export interface IServiceCollectionEntry {
    ID?: string;
    Title?: string;
    TechnicalServiceName?: string;
    TechnicalServiceVersion?: string;
    Description?: string;
    ServiceUrl?: string;
    BaseUrl?: string;
    Namespace?: string;
}
export declare function discoverServices(context: ILoadOptionsFunctions): Promise<ISapODataService[]>;
export declare function getCommonServices(): ISapODataService[];
export declare function searchServices(services: ISapODataService[], keyword: string): ISapODataService[];
export declare function groupServicesByCategory(services: ISapODataService[]): Record<string, ISapODataService[]>;
