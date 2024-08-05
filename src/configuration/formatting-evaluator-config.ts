import { Static, Type } from "@sinclair/typebox";
import { CommentAssociation, CommentKind, CommentType } from "./comment-types";

export const commentType = Type.Union(
  Object.keys(CommentKind).flatMap((kind) =>
    Object.keys(CommentAssociation).map((association) => Type.Literal(`${kind}_${association}` as CommentType))
  )
);

const symbolsType = Type.Record(Type.String(), Type.Number(), { minProperties: 1 });

export const formattingEvaluatorConfigurationType = Type.Object(
  {
    /**
     * Multipliers applied to different parts of the comment body content
     */
    multipliers: Type.Array(
      Type.Object({
        select: Type.Array(commentType),
        formattingMultiplier: Type.Number(),
        symbols: symbolsType,
        /**
         * Attributed score per HTML entity
         */
        scores: Type.Record(Type.String(), Type.Number(), {
          default: {
            br: 0,
            code: 1,
            p: 1,
            em: 0,
            img: 0,
            strong: 0,
            blockquote: 0,
            h1: 1,
            h2: 1,
            h3: 1,
            h4: 1,
            h5: 1,
            h6: 1,
            a: 1,
            li: 1,
            td: 1,
            hr: 0,
          },
        }),
      }),
      {
        default: [
          {
            select: ["ISSUE_SPECIFICATION"],
            formattingMultiplier: 1,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
          {
            select: ["ISSUE_AUTHOR"],
            formattingMultiplier: 1,
            symbols: { "\\b\\w+\\b": 0.2 },
          },
          {
            select: ["ISSUE_ASSIGNEE"],
            formattingMultiplier: 0,
            symbols: { "\\b\\w+\\b": 0 },
          },
          {
            select: ["ISSUE_COLLABORATOR"],
            formattingMultiplier: 1,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
          {
            select: ["ISSUE_CONTRIBUTOR"],
            formattingMultiplier: 0.25,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
          {
            select: ["PULL_SPECIFICATION"],
            formattingMultiplier: 0,
            symbols: { "\\b\\w+\\b": 0 },
          },
          {
            select: ["PULL_AUTHOR"],
            formattingMultiplier: 2,
            symbols: { "\\b\\w+\\b": 0.2 },
          },
          {
            select: ["PULL_ASSIGNEE"],
            formattingMultiplier: 1,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
          {
            select: ["PULL_COLLABORATOR"],
            formattingMultiplier: 1,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
          {
            select: ["PULL_CONTRIBUTOR"],
            formattingMultiplier: 0.25,
            symbols: { "\\b\\w+\\b": 0.1 },
          },
        ],
      }
    ),
  },
  { default: {} }
);

export type FormattingEvaluatorConfiguration = Static<typeof formattingEvaluatorConfigurationType>;
