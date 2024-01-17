import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import type { Plugin, ResolvedConfig, ProxyOptions, PreviewServer } from 'vite';
import { setup, Parser } from '@assetrs/parser';
import getLocales, { getMetadata, prepareMetadata } from './locales';

let files: any[] = [];
let bundle: any = null;

const entrypointTemplate = Parser.wc_helper_js().replace('"use strict";', '');

export interface StaticAsset {
    src: string;
    dest: string;
}

export interface PageData {
    defaultLanguage?: string;
    name: string;
    title: string;
}

export interface Page {
    data: PageData;
}

export interface AssetRsPluginConfig {
    wc?: boolean;
    targetUrl?: string;
    name?: string;
    prefix?: string;
    fallbackPrefix?: string;
    staticAssets?: StaticAsset[];
    pages?: Page[];
}

async function processStaticAssets(
    assets: any[],
    staticAssets: StaticAsset[],
): Promise<any[]> {
    for (const staticAsset of staticAssets) {
        const files = fs.readdirSync(path.join('./dist', staticAsset.dest));
        for (const file of files) {
            assets.push(path.join(staticAsset.dest, file));
        }
    }
    return assets;
}

async function postProcessSPA(
    assets: string[],
    targetUrl: string,
    config: AssetRsPluginConfig,
): Promise<void> {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const manifest = JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        target_url: targetUrl,
        assets: processStaticAssets(assets, config.staticAssets ?? []),
        spa: config.wc ?? false,
    });
    fs.writeFileSync(`./dist/manifest.json`, manifest, 'utf-8');
    setup();
    const parser = new Parser(`./dist/manifest.json`);
    parser.parse();
}

interface Locale {
    lang: string;
    path: string;
}

interface Component {
    path: string;
    name: string;
    locales: Locale[];
    locales_metadata_path: string | undefined;
}

type ComponentMap = Record<string, Component>;
type TitlesMap = Record<string, string>;
type DefaultLanguagesMap = Record<string, string>;

async function postProcessWc(
    config: AssetRsPluginConfig,
    files: any[],
    bundle: any,
): Promise<void> {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const assets = files.map((f) => f.key);
    const components: ComponentMap = {};
    const m: any = getLocales();

    const titles: TitlesMap = (config.pages ?? []).reduce(
        (state: TitlesMap, page: Page) => {
            state[page.data.name] = page.data.title;
            return state;
        },
        {},
    );

    const defaultLanguages: DefaultLanguagesMap = (config.pages ?? []).reduce(
        (state: DefaultLanguagesMap, page: Page) => {
            state[page.data.name] = page.data.defaultLanguage ?? 'de';
            return state;
        },
        {},
    );
    const localesMetaDataInput: any = await getMetadata();
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isEntry as boolean) {
            const locales: Locale[] = [];
            const name = bundle[file.key].name;
            let title = name;
            let localesMetadataPath;
            if (titles[name]) {
                title = titles[name];
            }
            if (m[name] as boolean) {
                const languages = Object.keys(m[name]);
                if (languages.length !== 0) {
                    fs.mkdirSync(`./dist/locales/${name}`, {
                        recursive: true,
                    });
                    for (const lang of languages) {
                        const localePath = `locales/${name}/${lang}.json`;
                        fs.writeFileSync(
                            `./dist/${localePath}`,
                            JSON.stringify(m[name][lang]),
                            'utf-8',
                        );
                        locales.push({
                            lang,
                            path: localePath,
                        });
                    }
                    if (localesMetaDataInput[name]) {
                        localesMetadataPath = `locales/${name}/meta.json`;
                        const defaultLanguage = defaultLanguages[name];
                        fs.writeFileSync(
                            `./dist/${localesMetadataPath}`,
                            JSON.stringify(
                                prepareMetadata(
                                    name,
                                    localesMetaDataInput[name],
                                    m[name][defaultLanguage],
                                    defaultLanguage,
                                    languages,
                                ),
                            ),
                            'utf-8',
                        );
                    }
                }
            }
            const out = entrypointTemplate
                .replace('TARGET_COMPONENT', name)
                .replace('TARGET_URL', config.targetUrl + '/' + file.key);
            fs.mkdirSync(`./dist/${config.fallbackPrefix}/${name}`, {
                recursive: true,
            });
            const entryPointPath = `${config.fallbackPrefix}/${name}/${name}.js`;
            fs.writeFileSync(`./dist/${entryPointPath}`, out, 'utf-8');
            assets.push(entryPointPath);
            components[name] = {
                path: entryPointPath,
                name: title,
                locales,
                locales_metadata_path: localesMetadataPath,
            };
        }
    }
    const manifest = JSON.stringify({
        name: config.name ?? pkg.name,
        version: pkg.version,
        target_url: config.targetUrl,
        assets: await processStaticAssets(assets, config.staticAssets ?? []),
        web_components: components,
    });
    fs.writeFileSync(`./dist/manifest.json`, manifest, 'utf-8');
    setup();
    const parser = new Parser(`./dist/manifest.json`);
    parser.parse();
}

const proxy: Record<string, string | ProxyOptions> = {
    '/embed/09000001': {}, // proxy our /api route to nowhere
};

function createPreviewApp(config: AssetRsPluginConfig): Express.Application {
    const locales = getLocales();
    const app = express();
    app.use(cors());
    if (config.wc ?? false) {
        app.get(
            '/embed/09000001/:serviceId/locales/:lang.:format',
            (req: any, res: any) => {
                const serviceId = req.params.serviceId;
                const lang = req.params.lang;
                const format = req.params.format;
                if (serviceId && lang && format === 'json') {
                    let result = locales[serviceId] ?? ({} as any);
                    result = result[lang] ?? null;
                    if (result === null) {
                        console.error(locales);
                        res.status(404).send('not found');
                    } else {
                        res.json(result);
                    }
                } else {
                    res.status(404).send('not found');
                }
            },
        );
    }
    return app;
}

const PLUGIN_NAME = 'ars-vite-plugin';
export default function ars(config: AssetRsPluginConfig = {}): Plugin {
    config.wc = config.wc ?? false;
    config.prefix = config.prefix ?? 'esm';
    config.fallbackPrefix = config.fallbackPrefix ?? 'embed';
    config.targetUrl = config.targetUrl ?? 'http://localhost:10240';
    let viteConfig: ResolvedConfig | null = null;
    let assets: string[] = [];
    return {
        name: PLUGIN_NAME,
        config() {
            return {
                preview: {
                    proxy,
                    cors: {
                        origin: '*',
                        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
                        preflightContinue: false,
                        optionsSuccessStatus: 204,
                    },
                },
            };
        },
        configurePreviewServer(server: PreviewServer) {
            server.middlewares.use(createPreviewApp(config) as any);
        },
        async configResolved(config: ResolvedConfig) {
            viteConfig = config;
        },
        buildStart() {
            this.info('ARS -> build start: ' + viteConfig?.base);
            assets = [];
            files = [];
        },
        generateBundle(_: any, b: any, isWrite: any) {
            if (isWrite as boolean) {
                assets = Object.keys(b);
                files = assets.map((k) => {
                    return {
                        key: k,
                        name: b[k].name,
                        type: b[k].type,
                        fileName: b[k].fileName,
                        dynamicImports: b[k].dynamicImports,
                        isEntry: b[k].isEntry,
                    };
                });
                bundle = b;
            }
        },
        async closeBundle() {
            if (config.wc ?? false) {
                await postProcessWc(config, files, bundle);
            } else {
                await postProcessSPA(assets, viteConfig?.base ?? '', config);
            }
        },
    };
}
export { ars };
