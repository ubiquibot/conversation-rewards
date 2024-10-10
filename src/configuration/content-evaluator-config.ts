import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const openAiType = Type.Object(
  {
    /**
     * AI model to use for comment evaluation.
     */
    model: Type.String({ default: "gpt-4o-2024-08-06" }),
    /**
     * Specific endpoint to send the comments to.
     */
    endpoint: Type.String({ default: "https://api.openai.com/v1" }),
  },
  { default: {} }
);

export const contentEvaluatorConfigurationType = Type.Object({
  openAi: openAiType,
  /**
   * Multipliers applied to different types of comments
   */
  multipliers: Type.Array(
    Type.Object({
      role: Type.Array(commentType),
      relevance: Type.Optional(Type.Number()),
    }),
    {
      default: [
        {
          role: ["ISSUE_SPECIFICATION"],
          relevance: 1,
        },
      ],
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
