/**
 * CSS do widget, injetado uma unica vez no <head>. Prefixo `vf-` evita
 * colisoes com o CSS da loja hospedeira. Sem dependencia de Tailwind.
 */
export const WIDGET_CSS = `
.vf-root{--vf-accent:#C4623A;--vf-ink:#141416;--vf-stone:#6F6B66;--vf-mist:#E9E5DF;--vf-ivory:#F7F4EF;--vf-sage:#5F7F6A;--vf-amber:#C99A3B;--vf-clay:#B4553F;--vf-slate:#8A96A3;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--vf-ink);font-size:14px;line-height:1.45}
.vf-root *{box-sizing:border-box}
.vf-trigger{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--vf-mist);background:#fff;color:var(--vf-ink);border-radius:999px;padding:10px 16px 10px 12px;font-weight:500;cursor:pointer;transition:box-shadow .2s,transform .2s,border-color .2s;font-size:14px}
.vf-trigger:hover{box-shadow:0 8px 24px -12px rgba(20,20,22,.3);transform:translateY(-1px);border-color:#d8d2ca}
.vf-trigger-mark{width:26px;height:26px;border-radius:50%;background:var(--vf-ink);display:inline-flex;align-items:center;justify-content:center}
.vf-trigger-brand{font-size:11px;color:var(--vf-stone);letter-spacing:.06em;text-transform:uppercase;margin-left:2px}
.vf-overlay{position:fixed;inset:0;background:rgba(20,20,22,.45);backdrop-filter:blur(4px);z-index:99998;display:flex;align-items:center;justify-content:center;padding:16px;animation:vf-fade .2s ease}
.vf-modal{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 24px 80px -24px rgba(20,20,22,.5);position:relative;animation:vf-rise .25s cubic-bezier(.2,.8,.2,1)}
.vf-modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0}
.vf-logo{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:.02em;font-size:18px}
.vf-logo b{color:var(--vf-accent);font-weight:600}
.vf-close{border:0;background:var(--vf-ivory);width:32px;height:32px;border-radius:50%;cursor:pointer;color:var(--vf-stone);font-size:16px}
.vf-body{padding:16px 24px 24px}
.vf-title{font-family:Fraunces,Georgia,serif;font-size:24px;font-weight:500;margin:6px 0 4px;letter-spacing:-.01em}
.vf-sub{color:var(--vf-stone);margin:0 0 18px}
.vf-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vf-field label{display:block;font-size:12px;color:var(--vf-stone);margin-bottom:6px;letter-spacing:.02em}
.vf-field input{width:100%;border:1px solid var(--vf-mist);border-radius:12px;padding:10px 12px;font-size:15px;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s;font-family:inherit}
.vf-field input:focus{border-color:var(--vf-ink);box-shadow:0 0 0 3px rgba(20,20,22,.06)}
.vf-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;background:var(--vf-ivory);padding:4px;border-radius:12px;margin-top:6px}
.vf-seg button{border:0;background:transparent;padding:9px;border-radius:9px;cursor:pointer;color:var(--vf-stone);font-weight:500;font-family:inherit;font-size:13px;transition:all .15s}
.vf-seg button.on{background:#fff;color:var(--vf-ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.vf-cta{margin-top:18px;width:100%;border:0;background:var(--vf-ink);color:#fff;border-radius:999px;padding:14px;font-size:15px;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s,transform .15s}
.vf-cta:hover{background:#2A2A2E;transform:translateY(-1px)}
.vf-cta:disabled{opacity:.6;cursor:progress}
.vf-note{font-size:11.5px;color:var(--vf-stone);margin-top:12px;text-align:center}
.vf-error{background:#fbeeea;color:#8a3a26;border-radius:12px;padding:10px 12px;margin-top:12px;font-size:13px}
.vf-result{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;margin:8px 0 18px}
.vf-size{width:104px;height:104px;border-radius:26px;background:var(--vf-ink);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Fraunces,Georgia,serif}
.vf-size b{font-size:46px;font-weight:500;line-height:1}
.vf-size span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-top:6px;font-family:Inter,system-ui,sans-serif}
.vf-score{font-family:Fraunces,Georgia,serif;font-size:34px;font-weight:500;line-height:1}
.vf-score small{font-size:16px;color:var(--vf-stone)}
.vf-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:500;margin-top:8px;background:var(--vf-ivory);color:var(--vf-ink)}
.vf-badge i{width:7px;height:7px;border-radius:50%;display:inline-block}
.vf-regions{display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:8px;margin:14px 0}
.vf-region{border:1px solid var(--vf-mist);border-radius:12px;padding:10px;text-align:center}
.vf-region small{display:block;color:var(--vf-stone);font-size:11px;margin-bottom:6px}
.vf-region i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}
.vf-region span{font-size:12px;font-weight:500}
.vf-compare{display:flex;gap:6px;margin:6px 0 14px}
.vf-compare button{flex:1;border:1px solid var(--vf-mist);background:#fff;border-radius:12px;padding:10px 6px;cursor:pointer;font-family:inherit;transition:all .15s}
.vf-compare button b{display:block;font-size:15px}
.vf-compare button span{font-size:12px;color:var(--vf-stone)}
.vf-compare button.rec{border-color:var(--vf-ink);background:var(--vf-ink);color:#fff}
.vf-compare button.rec span{color:rgba(255,255,255,.75)}
.vf-explain{background:var(--vf-ivory);border-radius:14px;padding:12px 14px;color:var(--vf-ink-2,#2A2A2E);font-size:13px}
.vf-actions{display:flex;gap:8px;margin-top:14px}
.vf-ghost{flex:1;border:1px solid var(--vf-mist);background:#fff;border-radius:999px;padding:12px;cursor:pointer;font-family:inherit;font-weight:500}
.vf-primary{flex:1;border:0;background:var(--vf-accent);color:#fff;border-radius:999px;padding:12px;cursor:pointer;font-family:inherit;font-weight:500}
.vf-spinner{width:44px;height:44px;border-radius:50%;border:3px solid var(--vf-mist);border-top-color:var(--vf-ink);animation:vf-spin .8s linear infinite;margin:32px auto 12px}
.vf-loading{text-align:center;color:var(--vf-stone);padding-bottom:20px}
.vf-steps{display:flex;gap:6px;margin:0 0 16px}
.vf-steps i{flex:1;height:3px;border-radius:2px;background:var(--vf-mist)}
.vf-steps i.on{background:var(--vf-ink)}
@keyframes vf-fade{from{opacity:0}to{opacity:1}}
@keyframes vf-rise{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
@keyframes vf-spin{to{transform:rotate(360deg)}}
@media (max-width:480px){.vf-grid{grid-template-columns:1fr}.vf-result{grid-template-columns:1fr;text-align:center}.vf-size{margin:0 auto}}
`;

let injected = false;

export function ensureStyles(doc: Document | undefined = typeof document === "undefined" ? undefined : document): void {
  if (!doc || injected) return;
  if (doc.getElementById("veste-widget-css")) {
    injected = true;
    return;
  }
  const style = doc.createElement("style");
  style.id = "veste-widget-css";
  style.textContent = WIDGET_CSS;
  doc.head.appendChild(style);
  injected = true;
}
