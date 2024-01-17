import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import merge from 'deepmerge';

function scan(component?: string): any {
    const messages: any = {};
    const localeDir =
        (component ?? null) === null
            ? './src/locales'
            : `./src/services/${component}/locales`;
    if (fs.existsSync(localeDir)) {
        const locales = fs.readdirSync(localeDir);
        for (const localeFile of locales) {
            const lang = localeFile.replace('.json', '');
            if (fs.existsSync(`${localeDir}/${lang}.json`)) {
                try {
                    messages[lang] = JSON.parse(
                        fs.readFileSync(`${localeDir}/${lang}.json`, 'utf-8'),
                    );
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }
    return messages;
}

function scanServices(): string[] {
    const serviceDir = './src/services';
    if (fs.existsSync(serviceDir)) {
        return fs.readdirSync(serviceDir);
    }
    return [];
}

function mergeArray(a: any, b: any): any {
    for (let i = 0; i < b.length; i++) {
        const element = b[i];
        if (a.indexOf(element) === -1) {
            a.push(element);
        }
    }
    return a;
}

async function scanMetadata(metaData: any, component?: string): Promise<any> {
    const localeMetadataFile =
        (component ?? null) === null
            ? path.resolve(process.cwd(), './src/locales/meta.js')
            : path.resolve(
                  process.cwd(),
                  `./src/services/${component}/locales/meta.js`,
              );
    if (fs.existsSync(localeMetadataFile)) {
        try {
            const newMetadata = await import(localeMetadataFile);
            metaData.hideable = mergeArray(
                metaData.hideable,
                newMetadata.default.hideable,
            );
            metaData.html = mergeArray(metaData.html, newMetadata.default.html);
            metaData.details = {
                ...metaData.details,
                ...newMetadata.default.details,
            };
        } catch (error) {
            console.log('ignore ', localeMetadataFile, error);
        }
    } else {
        console.error('unable to find module', localeMetadataFile);
    }
    return metaData;
}

function flatten(result: any = {}, key: string, value: any): any {
    if (key === '') {
        if (typeof value === 'object' && value) {
            Object.keys(value).forEach((k) => {
                flatten(result, k, value[k]);
            });
        } else if (typeof value === 'string') {
            result[key] = value;
        }
    } else {
        if (typeof value === 'object' && value) {
            Object.keys(value).forEach((k) => {
                flatten(result, `${key}.${k}`, value[k]);
            });
        } else if (typeof value === 'string') {
            result[key] = value;
        }
    }
}

function messageContentType(key: string, metaData: any): string {
    if (metaData.html.indexOf(key) !== -1) {
        return 'text/html';
    }
    return 'text/plain';
}

function createMessages(metaData: any, messages: any): any {
    const flattenedMessages = {};
    flatten(flattenedMessages, '', messages);
    return Object.keys(flattenedMessages).map((key) => {
        return {
            path: key,
            hideable: metaData.hideable.indexOf(key) !== -1,
            contentType: messageContentType(key, metaData),
            details: metaData.details?.[key] ? metaData.details[key] : null,
        };
    });
}

export function prepareMetadata(
    name: string,
    metaData: any,
    locales: any,
    defaultLanguage: string,
    languages: string[],
): any {
    const messages = createMessages(metaData, locales);
    return {
        service: name,
        defaultLanguage,
        languages,
        messages,
    };
}

export async function getMetadata(): Promise<any> {
    const servicesMetadata: any = {};
    const defaultMetadata = {
        hideable: [],
        html: [],
        details: {},
    };
    let metaData = await scanMetadata(defaultMetadata);
    const services = scanServices();
    for (const service of services) {
        metaData = await scanMetadata(metaData, service);
        servicesMetadata[service] = metaData;
    }
    return servicesMetadata;
}

export default function getLocales(): any {
    const defaultMessages = scan();
    return scanServices().reduce((state: any, current: string) => {
        state[current] = merge({ ...defaultMessages }, scan(current));
        return state;
    }, {});
}
