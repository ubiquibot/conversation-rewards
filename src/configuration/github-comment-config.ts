import { Static, Type } from "@sinclair/typebox";

export const githubCommentConfigurationType = Type.Object(
  {
    /**
     * Enables posting to the related GitHub Issue
     */
    post: Type.Boolean({ default: true }),
    /**
     * Enables debug by creating a local html file of the rendered comment
     */
    debug: Type.Boolean({ default: false }),
  },
  { default: {} }
);

export type GithubCommentConfiguration = Static<typeof githubCommentConfigurationType>;
