'use strict';
(() => {
    function c(t, o) {
        return o.querySelector('script[href="' + t + '"]')
            ? Promise.resolve()
            : new Promise((r, s) => {
                  var e = document.createElement('script');
                  (e.src = t),
                      e.setAttribute('type', 'module'),
                      (e.crossOrigin = ''),
                      e.setAttribute('charset', 'UTF-8'),
                      (e.onload = (n) => {
                          console.log(n), r();
                      }),
                      (e.onreadystatechange = (n) => {
                          r();
                      }),
                      (e.onerror = (n) => {
                          s(n);
                      }),
                      o.appendChild(e);
              });
    }
    var a = 'TARGET_COMPONENT',
        d = 'TARGET_URL';
    c(d, document.head).then(() => {
        let t = new CustomEvent('ars-component-loaded', { detail: a });
        document.dispatchEvent(t);
    });
})();
