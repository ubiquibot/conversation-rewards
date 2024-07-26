import { Static, Type } from "@sinclair/typebox";

export const dataCollectionConfigurationType = Type.Object(
  {
    /**
     * The maximum amount of retries on failure.
     */
    maxAttempts: Type.Number({ default: 10, minimum: 1 }),
    /**
     * The delay between each retry, in milliseconds.
     */
    delayMs: Type.Number({ default: 10000, minimum: 100 }),
  },
  { default: {} }
);

export type DataCollectionConfiguration = Static<typeof dataCollectionConfigurationType>;
