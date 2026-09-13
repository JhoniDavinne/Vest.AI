/**
 * Ponto de entrada para incorporacao via <script> em lojas sem React.
 *
 * <div id="veste-fit" data-sku="CAMISETA-001-M"></div>
 * <script src="https://cdn.veste.ai/widget.iife.js"></script>
 * <script>VesteAI.mount('#veste-fit', { apiBaseUrl: 'https://api.veste.ai', apiKey: '...' })</script>
 */
import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { VesteFit, type VesteFitProps } from "./VesteFit";

const roots = new WeakMap<Element, Root>();

export function mount(target: string | Element, props: VesteFitProps = {}): () => void {
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) throw new Error(`VesteAI.mount: alvo nao encontrado (${String(target)})`);
  const dataset = (element as HTMLElement).dataset ?? {};
  const merged: VesteFitProps = {
    sku: dataset.sku,
    productId: dataset.productId,
    apiBaseUrl: dataset.apiBaseUrl,
    apiKey: dataset.apiKey,
    ...props,
  };
  const root = roots.get(element) ?? createRoot(element);
  roots.set(element, root);
  root.render(React.createElement(VesteFit, merged));
  return () => {
    root.unmount();
    roots.delete(element);
  };
}

export { VesteFit };
export type { VesteFitProps };
