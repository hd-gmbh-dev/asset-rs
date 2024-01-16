function loadJS(
    url: string,
    location: HTMLHeadElement | HTMLBodyElement,
): Promise<void> {
    if (!location.querySelector('script[href="' + url + '"]')) {
        return new Promise((res, rej) => {
            var scriptTag = document.createElement('script');
            scriptTag.src = url;
            scriptTag.setAttribute('type', 'module');
            scriptTag.crossOrigin = '';
            scriptTag.setAttribute('charset', 'UTF-8');
            scriptTag.onload = (event) => {
                console.log(event);
                res();
            };
            (scriptTag as any).onreadystatechange = (_: any) => {
                res();
            };
            scriptTag.onerror = (err) => {
                rej(err);
            };
            location.appendChild(scriptTag);
        });
    }
    return Promise.resolve();
}
const TARGET_COMPONENT = 'TARGET_COMPONENT';
const TARGET_URL = 'TARGET_URL';
loadJS(TARGET_URL, document.head).then(() => {
    const event = new CustomEvent('ars-component-loaded', {
        detail: TARGET_COMPONENT,
    });
    document.dispatchEvent(event);
});
