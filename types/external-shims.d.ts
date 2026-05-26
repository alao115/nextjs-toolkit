// Type shims for npm packages that don't ship .d.ts files and have no
// corresponding @types/* on DefinitelyTyped (as of writing).
//
// Replace each `declare module "..."` with a proper @types/* dependency
// or a local typed stub once the upstream lib publishes types.

declare module "twig";

// The packages below DO have @types/* on DefinitelyTyped but the package
// keeps them as optional peer deps to stay lean. Consumers using these
// adapters should `npm install --save-dev @types/{nodemailer,express-session,luxon}`.
declare module "nodemailer";
declare module "express-session";
declare module "luxon";
