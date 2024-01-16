import fs from 'fs';

import merge from 'deepmerge';

function scan(component?: string): any {
    const messages: any = {};
    const localeDir =
        (component ?? null) === null
            ? `./src/services/${component}/locales`
            : './src/locales';
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

export default function getLocales(): any {
    const defaultMessages = scan();
    return scanServices().reduce((state: any, current: string) => {
        state[current] = merge({ ...defaultMessages }, scan(current));
        return state;
    }, {});
}
