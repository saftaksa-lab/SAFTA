/**
 * Registered automatically by Astro via Vite.
 *
 * Vite unshifts postcss-import ahead of these plugins, so the `@custom-media`
 * rules declared in src/styles/2-design-tokens/breakpoints.css are already
 * inlined by the time postcss-custom-media runs, and resolve across every
 * layer of the bundle.
 */
export default {
  plugins: {
    'postcss-custom-media': {},
  },
};
