/** Where the agent service lives. LEARIS_API wins when set (local dev, the EC2 compose stack).
 * Hosts that cannot take environment variables (the HackOnVibe team domain builds the repo as is)
 * reach the public agent service on EC2 in production. */
const HOSTED_API = "https://api.learis.lumbungstack.dev";

export const UPSTREAM = process.env.LEARIS_API
  ?? (process.env.NODE_ENV === "production" ? HOSTED_API : "http://127.0.0.1:8787");
