import fs from "node:fs";
import type { Plugin, ResolvedConfig } from 'vite';
import { setup, Parser } from '@assetrs/parser'

async function postProcessSPA(assets: string[], target_url: string) {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    const manifest = JSON.stringify({ name: pkg.name, version: pkg.version, target_url, assets, spa: true });
    fs.writeFileSync(`./dist/manifest.json`, manifest, "utf-8");
    setup();
    const parser = new Parser(`./dist/manifest.json`);
    parser.parse()
}

const PLUGIN_NAME = 'ars-vite-plugin';
export default function ars(): Plugin {
    let viteConfig: ResolvedConfig | null = null;
    let assets: string[] = [];
    return {
        name: PLUGIN_NAME,
        async configResolved(config: ResolvedConfig) {
            viteConfig = config;
        },
        buildStart() {
            this.info('ARS -> build start: ' + viteConfig?.base);
            assets = [];
        },
        generateBundle(_, b, isWrite) {
            if (isWrite) {
                assets = Object.keys(b)
            }
          },
        closeBundle() {
            postProcessSPA(assets, viteConfig?.base ?? '')
        }
    };
}
