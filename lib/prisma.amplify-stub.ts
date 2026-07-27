/**
 * Amplify UI-only stub for @/lib/prisma.
 * Webpack aliases this module when AMPLIFY_SSR=true so builds never open a DB.
 */
function unavailable(): never {
    throw new Error(
        "[Amplify] Prisma is unavailable on Amplify UI builds. Call Nest APIs instead."
    );
}

const handler: ProxyHandler<object> = {
    get() {
        return new Proxy(function () {}, {
            apply: () => unavailable(),
            get: () => unavailable,
        });
    },
};

export const prisma = new Proxy({}, handler) as never;
export const prismaJobs = prisma;
export const prismaCron = prisma;
export default prisma;
