declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string;
      OPENAI_API_KEY: string;
      X25519_PRIVATE_KEY: string;
      SUPABASE_KEY: string;
      SUPABASE_URL: string;
      NFT_CONTRACT_ADDRESS: string;
      NFT_MINTER_PRIVATE_KEY: string;
      PERMIT_FEE_RATE: string;
      PERMIT_TREASURY_GITHUB_USERNAME: string;
      PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: string;
      COMMENT_ID: string | undefined;
    }
  }
}

export {};
