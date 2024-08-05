import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

export const contentEvaluatorConfigurationType = Type.Object({
  /**
   * Multipliers applied to different types of comments
   */
  multipliers: Type.Array(
    Type.Object({
      select: Type.Array(commentType),
      relevance: Type.Optional(Type.Number()),
    }),
    {
      default: [
        {
          select: ["ISSUE_SPECIFICATION"],
          relevance: 1,
        },
        {
          select: ["PULL_AUTHOR"],
          relevance: 1,
        },
        {
          select: ["PULL_ASSIGNEE"],
          relevance: 1,
        },
        {
          select: ["PULL_COLLABORATOR"],
          relevance: 1,
        },
        {
          select: ["PULL_CONTRIBUTOR"],
          relevance: 1,
        },
      ],
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
