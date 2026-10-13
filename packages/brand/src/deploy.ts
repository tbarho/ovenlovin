const stores = encodeURIComponent(
  JSON.stringify([
    { type: "integration", integrationSlug: "neon", productSlug: "neon", protocol: "storage" },
    { type: "blob" },
    { type: "integration", integrationSlug: "clerk", productSlug: "clerk" },
  ])
);

export const VERCEL_DEPLOY_URL =
  `https://vercel.com/new/clone` +
  `?repository-url=https://github.com/tbarho/ovenlovin` +
  `&root-directory=apps/web` +
  `&project-name=ovenlovin` +
  `&repository-name=ovenlovin` +
  `&stores=${stores}` +
  `&env=AI_GATEWAY_API_KEY,USDA_FDC_API_KEY,NEXT_PUBLIC_INSTANCE_NAME` +
  `&envDescription=AI%20Gateway%2C%20USDA%2C%20and%20optional%20instance%20name.%20Neon%2C%20Blob%2C%20and%20Clerk%20come%20from%20the%20stores%20step.%20If%20Clerk%20is%20not%20offered%2C%20set%20NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY%20and%20CLERK_SECRET_KEY%20in%20Vercel.` +
  `&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting` +
  `&demo-title=OvenLovin` +
  `&demo-description=AI-powered%20family%20meal%20planning%20platform` +
  `&demo-url=https://ovenlovin.vercel.app`;
