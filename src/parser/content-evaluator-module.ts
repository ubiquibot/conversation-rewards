import Decimal from "decimal.js";
import OpenAI from "openai";
import configuration from "../configuration/config-reader";
import { OPENAI_API_KEY } from "../configuration/constants";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../configuration/content-evaluator-config";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";
import { Value } from "@sinclair/typebox/value";
import { commentEnum, CommentType } from "../configuration/comment-types";
import { Type } from "@sinclair/typebox";
import logger from "../helpers/logger";

type CommentToEvaluate = { id: number; comment: string };
type ReviewCommentToEvaluate = { id: number; comment: string; diff_hunk: string };
type Relevances = { [k: string]: number };

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule implements Module {
  readonly _openAi = new OpenAI({ apiKey: OPENAI_API_KEY });
  readonly _configuration: ContentEvaluatorConfiguration | null = configuration.incentives.contentEvaluator;
  private readonly _fixedRelevances: { [k: string]: number } = {};

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor() {
    if (this._configuration?.multipliers) {
      this._fixedRelevances = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.select.reduce((a, b) => this._getEnumValue(b) | a, 0)]: curr.relevance,
        };
      }, {});
    }
  }

  get enabled(): boolean {
    if (!Value.Check(contentEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid configuration detected for ContentEvaluatorModule, disabling.");
      return false;
    }
    return true;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const promises: Promise<GithubCommentScore[]>[] = [];

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      const specificationBody = data.self?.body;

      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(comments, specificationBody).then(
            (commentsWithScore) => (currentElement.comments = commentsWithScore)
          )
        );
      }
    }

    await Promise.all(promises);
    return result;
  }

  async _processComment(comments: Readonly<GithubCommentScore>[], specificationBody: string) {
    const commentsWithScore: GithubCommentScore[] = [...comments];

    // exclude comments that have fixed relevance multiplier. e.g. review comments = 1
    const commentsToEvaluate: CommentToEvaluate[] = [];
    const reviewCommentsToEvaluate: ReviewCommentToEvaluate[] = [];
    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      if (!this._fixedRelevances[currentComment.type]) {
        if (currentComment?.diff_hunk) {
          reviewCommentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
            diff_hunk: currentComment.diff_hunk,
          });
        } else {
          commentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
          });
        }
      }
    }

    const relevancesByAI = await this._evaluateComments(
      specificationBody,
      commentsToEvaluate,
      reviewCommentsToEvaluate
    );

    if (Object.keys(relevancesByAI).length !== commentsToEvaluate.length) {
      console.error("Relevance / Comment length mismatch! \nWill use 1 as relevance for missing comments.");
    }

    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      let currentRelevance = 1; // For comments not in fixed relevance types or missed by OpenAI evaluation

      if (this._fixedRelevances[currentComment.type]) {
        currentRelevance = this._fixedRelevances[currentComment.type];
      } else if (!isNaN(relevancesByAI[currentComment.id])) {
        currentRelevance = relevancesByAI[currentComment.id];
      }

      const currentReward = new Decimal(currentComment.score?.reward || 0);
      currentComment.score = {
        ...(currentComment.score || {}),
        relevance: new Decimal(currentRelevance).toNumber(),
        reward: currentReward.mul(currentRelevance).toNumber(),
      };
    }

    return commentsWithScore;
  }

  async _evaluateComments(
    specification: string,
    comments: CommentToEvaluate[],
    reviewComments: ReviewCommentToEvaluate[]
  ): Promise<Relevances> {
    let combinedRelevances: Relevances = {};

    if (comments.length) {
      const promptForComments = this._generatePromptForComments(specification, comments);
      combinedRelevances = await this._submitPrompt(promptForComments);
    }

    if (reviewComments.length) {
      const promptForReviewComments = this._generatePromptForComments(specification, reviewComments);
      const relevances = await this._submitPrompt(promptForReviewComments);
      combinedRelevances = { ...combinedRelevances, ...relevances };
    }

    return combinedRelevances;
  }

  async _submitPrompt(prompt: string): Promise<Relevances> {
    const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      temperature: 1,
      max_tokens: 128,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const rawResponse = String(response.choices[0].message.content);
    logger.info(`OpenAI raw response: ${rawResponse}`);

    const jsonResponse = JSON.parse(rawResponse);

    const responseType = Type.Record(Type.String(), Type.Number({ minimum: 0, maximum: 1 }));

    if (Value.Check(responseType, jsonResponse)) {
      const relevances = Value.Convert(responseType, jsonResponse) as { [k: string]: number };
      logger.info(`Relevances by OpenAI: ${JSON.stringify(relevances)}`);
      return relevances;
    } else {
      throw new Error(`Invalid response type received from openai while evaluating: ${jsonResponse}`);
    }
  }

  _generatePromptForComments(issue: string, comments: CommentToEvaluate[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the relevance of GitHub contributors' comments to a specific issue specification. Specifically, I'm interested in how much each comment helps to further define the issue specification or contributes new information or research relevant to the issue. Please provide a float between 0 and 1 to represent the degree of relevance. A score of 1 indicates that the comment is entirely relevant and adds significant value to the issue, whereas a score of 0 indicates no relevance or added value. A stringified JSON is given below that contains the specification and contributors' comments. Each comment in the JSON has a unique ID and comment content. \n\n\`\`\`\n${JSON.stringify(
      { specification: issue, comments: comments }
    )}\n\`\`\`\n\n\nTo what degree are each of the comments in the conversation relevant and valuable to further defining the issue specification? Please reply with ONLY a JSON where each key is the comment ID given in JSON above, and the value is a float number between 0 and 1 corresponding to the comment. The float number should represent the degree of relevance and added value of the comment to the issue. The total number of properties in your JSON response should equal exactly ${
      comments.length
    }.`;
  }

  _generatePromptForReviewComments(issue: string, comments: ReviewCommentToEvaluate[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the value of a GitHub contributor's code review. Specifically, I'm interested in how much each code review comment helps to solve the GitHub issue and improve code quality. Please provide a float between 0 and 1 to represent the value of the code review comment. A score of 1 indicates that the comment is very valuable and significantly improves the submitted solution and code quality, whereas a score of 0 indicates a  negative or zero impact. A stringified JSON is given below that contains the specification of the GitHub issue, and code review comments by different contributors. The property "diff_hunk" presents the chunk of code being addressed for a possible change. \n\n\`\`\`\n${JSON.stringify(
      { specification: issue, comments: comments }
    )}\n\`\`\`\n\n\nTo what degree are each of the code review comments valuable? Please reply with ONLY a JSON where each key is the comment ID given in JSON above, and the value is a float number between 0 and 1 corresponding to the comment. The float number should represent the value of the code review comment for improving the issue solution and code quality. The total number of properties in your JSON response should equal exactly ${
      comments.length
    }.`;
  }
}
