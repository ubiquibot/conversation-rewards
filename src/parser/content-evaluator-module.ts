import Decimal from "decimal.js";
import { encodingForModel, Tiktoken } from "js-tiktoken";
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
import { commentEnum, CommentKind, CommentType } from "../configuration/comment-types";
import logger from "../helpers/logger";
import {
  openAiRelevanceResponseSchema,
  CommentToEvaluate,
  Relevances,
  PrCommentToEvaluate,
} from "../types/content-evaluator-module-type";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule implements Module {
  readonly _configuration: ContentEvaluatorConfiguration | null = configuration.incentives.contentEvaluator;
  readonly _openAi = new OpenAI({
    apiKey: OPENAI_API_KEY,
    ...(this._configuration?.openAi.endpoint && { baseURL: this._configuration.openAi.endpoint }),
  });
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
          [curr.role.reduce((a, b) => this._getEnumValue(b) | a, 0)]: curr.relevance,
        };
      }, {});
    }
  }

  get enabled(): boolean {
    if (!Value.Check(contentEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for ContentEvaluatorModule, disabling.");
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
    const { commentsToEvaluate, prCommentsToEvaluate } = this._splitCommentsByPrompt(commentsWithScore);

    const relevancesByAI = await this._evaluateComments(specificationBody, commentsToEvaluate, prCommentsToEvaluate);

    if (Object.keys(relevancesByAI).length !== commentsToEvaluate.length) {
      console.error("Relevance / Comment length mismatch! \nWill use 1 as relevance for missing comments.");
    }

    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      let currentRelevance: number | string = '-'; // Default to '-' for skipped or unevaluated comments

      if (this._fixedRelevances[currentComment.type]) {
        currentRelevance = this._fixedRelevances[currentComment.type];
      } else if (!isNaN(relevancesByAI[currentComment.id])) {
        currentRelevance = relevancesByAI[currentComment.id];
      } else  {
        currentRelevance = '-';
      }

      const currentReward = new Decimal(currentComment.score?.reward || 0);
      currentComment.score = {
        ...(currentComment.score || {}),
        relevance: new Decimal(currentRelevance).toNumber(),
        reward: currentRelevance === '-' ? '-' : currentReward.mul(currentRelevance).toNumber(),
      };
    }

    return commentsWithScore;
  }

  /**
   * Will try to predict the maximum of tokens expected, to a maximum of totalTokenLimit.
   */
  _calculateMaxTokens(prompt: string, totalTokenLimit: number = 16384) {
    const tokenizer: Tiktoken = encodingForModel("gpt-4o-2024-08-06");
    const inputTokens = tokenizer.encode(prompt).length;
    return Math.min(inputTokens, totalTokenLimit);
  }

  _generateDummyResponse(comments: { id: number; comment: string }[]) {
    return comments.reduce<Record<string, number>>((acc, curr) => {
      return { ...acc, [curr.id]: 0.5 };
    }, {});
  }

  _splitCommentsByPrompt(commentsWithScore: Readonly<GithubCommentScore>[]): {
    commentsToEvaluate: CommentToEvaluate[];
    prCommentsToEvaluate: PrCommentToEvaluate[];
  } {
    const commentsToEvaluate: CommentToEvaluate[] = [];
    const prCommentsToEvaluate: PrCommentToEvaluate[] = [];
    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      if (!this._fixedRelevances[currentComment.type]) {
        if (currentComment.type & CommentKind.PULL) {
          prCommentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
            diffHunk: currentComment?.diffHunk,
          });
        } else {
          commentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
          });
        }
      }
    }
    return { commentsToEvaluate, prCommentsToEvaluate };
  }

  async _evaluateComments(
    specification: string,
    comments: CommentToEvaluate[],
    prComments: PrCommentToEvaluate[]
  ): Promise<Relevances> {
    let commentRelevances: Relevances = {};
    let prCommentRelevances: Relevances = {};

    if (comments.length) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(comments), null, 2);
      const maxTokens = this._calculateMaxTokens(dummyResponse);

      const promptForComments = this._generatePromptForComments(specification, comments);
      commentRelevances = await this._submitPrompt(promptForComments, maxTokens);
    }

    if (prComments.length) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(prComments), null, 2);
      const maxTokens = this._calculateMaxTokens(dummyResponse);

      const promptForPrComments = this._generatePromptForPrComments(specification, prComments);
      prCommentRelevances = await this._submitPrompt(promptForPrComments, maxTokens);
    }

    return { ...commentRelevances, ...prCommentRelevances };
  }

  async _submitPrompt(prompt: string, maxTokens: number): Promise<Relevances> {
    const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
      model: this._configuration?.openAi.model || "gpt-4o-2024-08-06",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      top_p: 1,
      temperature: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const rawResponse = String(response.choices[0].message.content);
    logger.info(`OpenAI raw response (using max_tokens: ${maxTokens}): ${rawResponse}`);

    const jsonResponse = JSON.parse(rawResponse);

    try {
      const relevances = Value.Decode(openAiRelevanceResponseSchema, jsonResponse);
      logger.info(`Relevances by OpenAI: ${JSON.stringify(relevances)}`);
      return relevances;
    } catch (e) {
      logger.error(`Invalid response type received from openai while evaluating: ${jsonResponse} \n\nError: ${e}`);
      throw new Error("Error in evaluation by OpenAI.");
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

  _generatePromptForPrComments(issue: string, comments: PrCommentToEvaluate[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the value of a GitHub contributor's comments in a pull request. Some of these comments are code review comments, and some are general suggestions or a part of the discussion. I'm interested in how much each comment helps to solve the GitHub issue and improve code quality. Please provide a float between 0 and 1 to represent the value of each comment. A score of 1 indicates that the comment is very valuable and significantly improves the submitted solution and code quality, whereas a score of 0 indicates a negative or zero impact. A stringified JSON is given below that contains the specification of the GitHub issue, and comments by different contributors. The property "diffHunk" presents the chunk of code being addressed for a possible change in a code review comment. \n\n\`\`\`\n${JSON.stringify(
      { specification: issue, comments: comments }
    )}\n\`\`\`\n\n\nTo what degree are each of the comments valuable? Please reply with ONLY a JSON where each key is the comment ID given in JSON above, and the value is a float number between 0 and 1 corresponding to the comment. The float number should represent the value of the comment for improving the issue solution and code quality. The total number of properties in your JSON response should equal exactly ${
      comments.length
    }.`;
  }
}
