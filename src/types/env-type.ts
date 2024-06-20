import { Type, Static } from "@sinclair/typebox";

const envConfigSchema = Type.Object({
  SUPABASE_URL: Type.String(),
  SUPABASE_KEY: Type.String(),
  GITHUB_TOKEN: Type.String(),
  X25519_PRIVATE_KEY: Type.String(),
  OPENAI_API_KEY: Type.String(),
  NFT_MINTER_PRIVATE_KEY: Type.String({ default: "" }),
  NFT_CONTRACT_ADDRESS: Type.String({ default: "" }),
  PERMIT_FEE_RATE: Type.Number({ default: 0 }),
  PERMIT_TREASURY_ADDRESS: Type.String(),
  PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: Type.String(),
});

export type EnvConfigType = Static<typeof envConfigSchema>;

export default envConfigSchema;
