/**
 * Type declarations for isomorphic-dompurify
 *
 * Since isomorphic-dompurify is a wrapper around DOMPurify,
 * we use DOMPurify's type definitions.
 */

declare module "isomorphic-dompurify" {
    import DOMPurify from "dompurify";
    export = DOMPurify;
}
