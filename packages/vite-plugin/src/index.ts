import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import type { Plugin, ResolvedConfig, ProxyOptions, PreviewServer } from 'vite';
import { setup, Parser } from '@assetrs/parser';
import getLocales from './locales';

let files: any[] = [];
let bundle: any = null;

const entrypointTemplate = Parser.wc_helper_js().replace('"use strict";', '');

export interface StaticAsset {
    src: string;
    dest: string;
}

export interface AssetRsPluginConfig {
    wc?: boolean;
    targetUrl?: string;
    name?: string;
    prefix?: string;
    fallbackPrefix?: string;
    staticAssets?: StaticAsset[];
}

function postProcessSPA(
    assets: string[],
    targetUrl: string,
    config: AssetRsPluginConfig,
): void {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const manifest = JSON.stringify({
        name: pkg.name,
        version: pkg.version,
        target_url: targetUrl,
        assets,
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
    locales: Locale[];
}

type ComponentMap = Record<string, Component>;

function postProcessWc(
    config: AssetRsPluginConfig,
    files: any[],
    bundle: any,
): void {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const assets = files.map((f) => f.key);
    const components: ComponentMap = {};
    const m: any = getLocales();
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.isEntry as boolean) {
            const locales: Locale[] = [];
            const name = bundle[file.key].name;
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
                locales,
            };
        }
    }
    const manifest = JSON.stringify({
        name: config.name ?? pkg.name,
        version: pkg.version,
        target_url: config.targetUrl,
        assets,
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
        closeBundle() {
            if (config.wc ?? false) {
                postProcessWc(config, files, bundle);
            } else {
                postProcessSPA(assets, viteConfig?.base ?? '', config);
            }
        },
    };
}
export { ars };
